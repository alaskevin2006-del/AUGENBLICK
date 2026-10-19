from collections.abc import Mapping

import random
import time
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction, connection, DatabaseError
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, ValidationError, PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CourseVersion, Enrollment, Event, Session, Submission
from .runtime import build_questions, initial_state, public_question, snapshot
from .scoring import evaluate


class Conflict(APIException):
    status_code = 409
    default_detail = "Activity state changed. Refresh and try again."


class AuthenticatedView(APIView):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method in ("POST", "PUT", "PATCH") and not isinstance(
            request.data, Mapping
        ):
            raise ValidationError("Request body must be a JSON object.")


def owned(request, session_id, lock=False):
    qs = Session.objects.select_related("course_version").filter(user=request.user)
    if lock:
        qs = qs.select_for_update()
    session = get_object_or_404(qs, pk=session_id)
    if session.is_preview:
        if not request.user.is_staff:
            raise PermissionDenied("Preview access requires a developer account.")
    else:
        if request.user.is_staff:
            raise PermissionDenied("Developers must use preview sessions.")
        if session.course_version.status != "published":
            from rest_framework.exceptions import NotFound

            raise NotFound("Course is not published.")
        if not Enrollment.objects.filter(
            user=request.user, course_version=session.course_version
        ).exists():
            raise PermissionDenied("Join this course before learning.")
    return session


def record(session, kind, payload):
    seq = (
        session.events.order_by("-seq").values_list("seq", flat=True).first() or 0
    ) + 1
    Event.objects.create(
        event_id=uuid.uuid4(),
        session=session,
        seq=seq,
        ts=int(time.time() * 1000),
        type=kind,
        payload=payload,
    )


class CourseListView(AuthenticatedView):
    def get(self, request):
        from .catalog_views import course_summary

        enrolled = set(
            Enrollment.objects.filter(user=request.user).values_list(
                "course_version_id", flat=True
            )
        )
        return Response(
            [
                course_summary(c, c.pk in enrolled)
                for c in CourseVersion.objects.filter(status="published").order_by(
                    "course_version_id"
                )
            ]
        )


class CoursePayloadView(AuthenticatedView):
    def get(self, request, course_version_id):
        if not request.user.is_staff:
            raise PermissionDenied("Authoring payload is restricted to staff.")
        return Response(get_object_or_404(CourseVersion, pk=course_version_id).payload)


class SessionListView(AuthenticatedView):
    def get(self, request):
        qs = (
            Session.objects.select_related("course_version")
            .filter(user=request.user)
            .order_by("-created_at")
        )
        preview = request.query_params.get("preview", "false")
        if preview not in ("true", "false"):
            raise ValidationError("preview query parameter must be true or false.")
        if preview == "true":
            if not request.user.is_staff:
                raise PermissionDenied("Preview access requires a developer account.")
            qs = qs.filter(is_preview=True)
        elif request.user.is_staff:
            qs = qs.none()
        else:
            qs = qs.filter(
                is_preview=False,
                course_version__status="published",
                course_version__enrollments__user=request.user,
            )
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("courseVersionId"):
            qs = qs.filter(course_version_id=request.query_params["courseVersionId"])
        return Response([snapshot(s) for s in qs])

    @transaction.atomic
    def post(self, request):
        # Lock the owner, including the empty-session case, to serialize start/restart.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        preview = request.data.get("preview", False)
        if type(preview) is not bool:
            raise ValidationError("preview must be a boolean.")
        if preview and not request.user.is_staff:
            raise PermissionDenied("Preview access requires a developer account.")
        if request.user.is_staff and not preview:
            raise PermissionDenied("Developers must use preview sessions.")
        available = (
            CourseVersion.objects.all()
            if preview
            else CourseVersion.objects.filter(status="published")
        )
        course = get_object_or_404(available, pk=request.data.get("courseVersionId"))
        if (
            not preview
            and not Enrollment.objects.filter(
                user=request.user, course_version=course
            ).exists()
        ):
            raise PermissionDenied("Join this course before learning.")
        if course.engine != "znawca":
            raise ValidationError("This engine is not available yet.")
        mode = request.data.get("mode")
        if mode not in ("L", "T"):
            raise ValidationError("mode must be L or T.")
        sessions = Session.objects.filter(
            user=request.user, course_version=course, mode=mode, is_preview=preview
        )
        if mode == "T" and not preview and sessions.filter(status="finished").exists():
            raise Conflict("This test has already been submitted.")
        count = request.data.get("itemCount")
        if count is not None and (type(count) is not int or count < 1 or count > 1000):
            raise ValidationError("itemCount must be an integer from 1 to 1000.")
        seed = random.SystemRandom().randint(0, 2**31 - 1)
        questions = build_questions(course.payload, seed)
        if not questions:
            raise ValidationError("This course has no usable questions.")
        questions = questions[:count] if count is not None else questions
        for previous in sessions.select_for_update().filter(status="active"):
            previous.status = "cancelled"
            previous.save(update_fields=["status", "updated_at"])
            record(previous, "activityInterrupted", {"restart": True})
        session = Session.objects.create(
            user=request.user,
            course_version=course,
            mode=mode,
            random_seed=seed,
            runtime=initial_state(questions),
            is_preview=preview,
        )
        record(
            session, "activityReady", {"mode": mode, "questionCount": len(questions)}
        )
        record(session, "itemStarted", {"questionId": session.runtime["queue"][0]})
        return Response(snapshot(session), status=201)


class SessionDetailView(AuthenticatedView):
    def get(self, request, session_id):
        return Response(snapshot(owned(request, session_id)))


class SessionEventsView(AuthenticatedView):
    def post(self, request, session_id):
        owned(request, session_id)
        raise ValidationError(
            "Client-authored scoring and progress events are disabled. Submit raw answers."
        )


class SessionAnswerView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, session_id):
        s = owned(request, session_id, lock=True)
        try:
            token = uuid.UUID(str(request.data.get("submissionId")))
        except (ValueError, TypeError, AttributeError):
            raise ValidationError("submissionId must be a UUID.")
        answer = request.data.get("answer")
        question_id = request.data.get("questionId")
        if (
            not isinstance(answer, str)
            or len(answer) > 10000
            or not isinstance(question_id, str)
        ):
            raise ValidationError("A questionId and text answer are required.")
        prior = Submission.objects.filter(session=s, submission_id=token).first()
        if prior:
            if prior.question_id != question_id or prior.answer != answer:
                raise Conflict("submissionId was already used for another answer.")
            return Response(prior.response)
        state = s.runtime
        if (
            s.status != "active"
            or state.get("feedback")
            or not state.get("queue")
            or state["queue"][0] != question_id
        ):
            raise Conflict("This question is not awaiting an answer.")
        q = state["questions"][question_id]
        feedback = evaluate(
            answer,
            q["acceptedAnswers"],
            subscript_compatible=bool(
                s.course_version.payload.get("answerRules", {}).get(
                    "subscriptCompatible", False
                )
            ),
        )
        feedback["submissionId"] = str(token)
        feedback["correctAnswerLabels"] = [
            q.get("answerLabels", {}).get(v, v) for v in feedback["correctAnswers"]
        ]
        if q.get("answerLabels"):
            feedback["correctOptionValues"] = list(feedback["correctAnswers"])
            media_paths = {o["value"]: o["media"]["path"] for o in q["options"]}
            for key in ("correctAnswers", "matched", "missed", "extra"):
                feedback[key] = [media_paths.get(v, v) for v in feedback[key]]
        if s.mode == "T":
            mastered = True
        elif feedback["fullyCorrect"]:
            state["streaks"][question_id] = state["streaks"].get(question_id, 0) + 1
            mastered = (
                question_id not in state["failed"] or state["streaks"][question_id] >= 2
            )
        else:
            if question_id not in state["failed"]:
                state["failed"].append(question_id)
            state["streaks"][question_id] = 0
            mastered = False
        feedback["needsAnother"] = s.mode == "L" and not mastered
        if mastered:
            state["mastered"].append(question_id)
        if question_id in state["cycleRemaining"]:
            state["cycleRemaining"].remove(question_id)
        if not state["cycleRemaining"]:
            state["cycles"] += 1
            state["cycleRemaining"] = [
                qid for qid in state["questions"] if qid not in state["mastered"]
            ]
        state["feedback"] = feedback
        state["review"].append(
            {"question": public_question(q), "answer": answer, "feedback": feedback}
        )
        s.save(update_fields=["runtime", "updated_at"])
        record(
            s, "itemResolved", {"questionId": question_id, "answer": answer, **feedback}
        )
        result = snapshot(s)
        Submission.objects.create(
            session=s,
            submission_id=token,
            question_id=question_id,
            answer=answer,
            response=result,
        )
        return Response(result)


class SessionNextView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, session_id):
        s = owned(request, session_id, lock=True)
        state = s.runtime
        if s.status != "active":
            raise Conflict("Activity is closed.")
        question_id = request.data.get("questionId")
        submission_id = request.data.get("submissionId")
        if not isinstance(question_id, str) or not isinstance(submission_id, str):
            raise ValidationError(
                "questionId and submissionId are required to dismiss feedback."
            )
        if (
            state.get("feedback")
            and state["queue"][0] == question_id
            and state["feedback"].get("submissionId") == submission_id
        ):
            qid = state["queue"].pop(0)
            if qid not in state["mastered"]:
                # Repeat failed learning questions at a reproducibly randomized position.
                # Keep at least one other pending question ahead when possible.
                rng = random.Random(s.random_seed + len(state["review"]))
                position = rng.randint(1, len(state["queue"])) if state["queue"] else 0
                state["queue"].insert(position, qid)
            state["feedback"] = None
            s.save(update_fields=["runtime", "updated_at"])
            if state["queue"]:
                record(s, "itemStarted", {"questionId": state["queue"][0]})
        return Response(snapshot(s))


class SessionFinishView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, session_id):
        # Same lock ordering as start: owner then session; prevents restart/finish races.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        s = owned(request, session_id, lock=True)
        if s.status == "finished":
            return Response(snapshot(s))
        if not snapshot(s)["canFinish"]:
            raise Conflict("Answer all questions before submitting.")
        scores = [r["feedback"]["score"] for r in s.runtime["review"]]
        s.total_score = sum(scores) / len(scores) if s.mode == "T" else 1.0
        s.status = "finished"
        s.save(update_fields=["total_score", "status", "updated_at"])
        record(
            s,
            "activityFinished",
            {
                "totalScore": s.total_score,
                "attemptConsumed": s.mode == "T" and not s.is_preview,
            },
        )
        return Response(snapshot(s))


class SessionSkipView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, session_id):
        s = owned(request, session_id, lock=True)
        if s.status == "skipped":
            return Response(snapshot(s))
        if not snapshot(s)["canSkip"]:
            raise Conflict(
                "Only learning activities after three cycles may be skipped."
            )
        s.status = "skipped"
        s.save(update_fields=["status", "updated_at"])
        record(
            s,
            "activitySkipped",
            {
                "unmastered": [
                    qid
                    for qid in s.runtime["questions"]
                    if qid not in s.runtime["mastered"]
                ]
            },
        )
        return Response(snapshot(s))


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except DatabaseError:
            return Response({"status": "unavailable"}, status=503)
        return Response({"status": "ok"})
