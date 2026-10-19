"""Owner-scoped records remain available after withdrawing or unpublishing."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from rest_framework.response import Response

from .catalog_views import course_summary
from .models import CourseVersion, Enrollment, Session
from .runtime import snapshot
from .views import AuthenticatedView, record


def scoped_sessions(user):
    return Session.objects.filter(user=user, is_preview=user.is_staff)


def difficult_objects(user, course_version_id=None):
    sessions = scoped_sessions(user).filter(status__in=["finished", "skipped"])
    if course_version_id is not None:
        sessions = sessions.filter(course_version_id=course_version_id)
    difficult = {}
    for session in (
        sessions.only("course_version_id", "runtime", "status", "updated_at")
        .order_by("updated_at", "id")
        .iterator()
    ):
        questions = session.runtime.get("questions", {})
        outcomes = {}
        for entry in session.runtime.get("review", []):
            question = questions.get(entry.get("question", {}).get("id"))
            if question is None:
                continue
            key = (session.course_version_id, question["objectId"])
            outcomes[key] = (
                outcomes.get(key, True)
                and entry.get("feedback", {}).get("fullyCorrect") is True
            )
        for key, correct in outcomes.items():
            if not correct:
                difficult[key] = {
                    "objectId": key[1],
                    "consecutiveCorrect": 0,
                    "lastPracticedAt": session.updated_at.isoformat(),
                }
            elif key in difficult and session.status == "finished":
                difficult[key]["consecutiveCorrect"] += 1
                difficult[key]["lastPracticedAt"] = session.updated_at.isoformat()
                if difficult[key]["consecutiveCorrect"] >= 2:
                    del difficult[key]
    return difficult


class UnenrollCourseView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, course_version_id):
        if request.user.is_staff:
            raise PermissionDenied("Developers use preview instead of enrollment.")
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        course = get_object_or_404(
            CourseVersion.objects.select_for_update(), pk=course_version_id
        )
        if course.status != "published" and not (
            Enrollment.objects.filter(user=request.user, course_version=course).exists()
            or scoped_sessions(request.user).filter(course_version=course).exists()
        ):
            raise NotFound("Course not found.")
        for session in (
            scoped_sessions(request.user)
            .select_for_update()
            .filter(course_version=course, status="active")
        ):
            session.status = "cancelled"
            session.save(update_fields=["status", "updated_at"])
            record(session, "activityInterrupted", {"withdrawal": True})
        Enrollment.objects.filter(user=request.user, course_version=course).delete()
        return Response(course_summary(course, False))


class HistoryView(AuthenticatedView):
    def get(self, request):
        page = request.query_params.get("page", "1")
        if not page.isascii() or not page.isdigit() or len(page) > 8 or int(page) < 1:
            raise ValidationError("page must be a positive integer.")
        page = int(page)
        sessions = (
            scoped_sessions(request.user)
            .select_related("course_version")
            .filter(status__in=["finished", "skipped", "cancelled"])
        )
        course_id = request.query_params.get("courseVersionId")
        if course_id is not None:
            sessions = sessions.filter(course_version_id=course_id)
        sessions = list(
            sessions.order_by("-updated_at", "-id")[(page - 1) * 50 : page * 50 + 1]
        )
        fields = (
            "sessionId",
            "courseVersionId",
            "title",
            "mode",
            "status",
            "isPreview",
            "totalScore",
            "progress",
        )
        return Response(
            {
                "results": [
                    {
                        **{
                            key: value
                            for key, value in snapshot(s).items()
                            if key in fields
                        },
                        "createdAt": s.created_at.isoformat(),
                        "updatedAt": s.updated_at.isoformat(),
                    }
                    for s in sessions[:50]
                ],
                "nextPage": page + 1 if len(sessions) > 50 else None,
            }
        )


class HistoryDetailView(AuthenticatedView):
    def get(self, request, session_id):
        session = get_object_or_404(
            scoped_sessions(request.user)
            .select_related("course_version")
            .filter(status__in=["finished", "skipped", "cancelled"]),
            pk=session_id,
        )
        return Response(
            {
                **snapshot(session),
                "review": session.runtime.get("review", []),
                "createdAt": session.created_at.isoformat(),
                "updatedAt": session.updated_at.isoformat(),
            }
        )


class DifficultiesView(AuthenticatedView):
    def get(self, request):
        objects = difficult_objects(
            request.user, request.query_params.get("courseVersionId")
        )
        courses = CourseVersion.objects.filter(
            pk__in={key[0] for key in objects}
        ).order_by("course_version_id")
        enrolled = set(
            Enrollment.objects.filter(user=request.user).values_list(
                "course_version_id", flat=True
            )
        )
        result = []
        for course in courses:
            items = [
                dict(objects[(course.pk, item["id"])], name=item["name"])
                for item in course.payload.get("items", [])
                if (course.pk, item["id"]) in objects
            ]
            if items:
                result.append(
                    {
                        "course": course_summary(course, course.pk in enrolled),
                        "items": items,
                    }
                )
        return Response(result)
