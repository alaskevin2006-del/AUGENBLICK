import random

from django.shortcuts import get_object_or_404
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CourseVersion, Event, Session

EVENT_TYPES = {"activityReady", "itemStarted", "itemResolved", "activityFinished"}


class CourseListView(APIView):
    """GET /api/courses/ —— 课程版本列表。"""

    def get(self, request):
        data = [
            {
                "courseVersionId": c.course_version_id,
                "title": c.title,
                "languageCode": c.language_code,
                "engine": c.engine,
                "itemCount": c.item_count,
            }
            for c in CourseVersion.objects.order_by("course_version_id")
        ]
        return Response(data)


class CoursePayloadView(APIView):
    """GET /api/courses/{courseVersionId}/payload/ —— 完整编译产物。"""

    def get(self, request, course_version_id):
        course = get_object_or_404(CourseVersion, pk=course_version_id)
        return Response(course.payload)


class SessionListView(APIView):
    """GET  恢复查询（?status=&courseVersionId= 过滤，最新在前）
    POST 创建会话。"""

    def get(self, request):
        sessions = Session.objects.order_by("-created_at")
        if status_q := request.query_params.get("status"):
            sessions = sessions.filter(status=status_q)
        if cv := request.query_params.get("courseVersionId"):
            sessions = sessions.filter(course_version_id=cv)
        return Response([
            {
                "sessionId": str(s.id),
                "attemptId": str(s.attempt_id),
                "randomSeed": s.random_seed,
                "courseVersionId": s.course_version_id,
                "mode": s.mode,
                "status": s.status,
                "resumeToken": s.resume_token,
                "createdAt": s.created_at.isoformat(),
            }
            for s in sessions
        ])

    def post(self, request):
        course = get_object_or_404(CourseVersion, pk=request.data.get("courseVersionId"))
        mode = request.data.get("mode")
        if mode not in ("L", "T"):
            return Response({"detail": "mode 必须是 'L' 或 'T'。"}, status=http.HTTP_400_BAD_REQUEST)
        session = Session.objects.create(
            course_version=course,
            mode=mode,
            random_seed=random.randint(0, 2**31 - 1),
        )
        return Response(
            {
                "sessionId": str(session.id),
                "attemptId": str(session.attempt_id),
                "randomSeed": session.random_seed,
                "resumed": False,
            },
            status=http.HTTP_201_CREATED,
        )


class SessionDetailView(APIView):
    """GET /api/sessions/{id}/ —— 会话状态。"""

    def get(self, request, session_id):
        session = get_object_or_404(Session, pk=session_id)
        return Response({
            "status": session.status,
            "mode": session.mode,
            "totalScore": session.total_score,
            "resumeToken": session.resume_token,
            "eventCount": session.events.count(),
        })


class SessionEventsView(APIView):
    """POST /api/sessions/{id}/events/ —— 推送事件批。
    eventId 幂等去重；seq 会话内从 1 严格递增，乱序/跳号 409。"""

    def post(self, request, session_id):
        session = get_object_or_404(Session, pk=session_id)
        events = request.data.get("events")
        if not isinstance(events, list):
            return Response({"detail": "events 必须是数组。"}, status=http.HTTP_400_BAD_REQUEST)

        accepted = 0
        warning = None
        last_seq = session.events.order_by("-seq").values_list("seq", flat=True).first() or 0

        for raw in events:
            event_id = raw.get("eventId")
            seq = raw.get("seq")
            ts = raw.get("ts")
            etype = raw.get("type")
            payload = raw.get("payload") or {}

            # 幂等：eventId 已存在 → 跳过不报错
            if Event.objects.filter(event_id=event_id).exists():
                continue

            if not isinstance(seq, int) or seq != last_seq + 1:
                return Response(
                    {"detail": f"seq 必须严格递增：期望 {last_seq + 1}，收到 {seq}。", "accepted": accepted},
                    status=http.HTTP_409_CONFLICT,
                )
            if etype not in EVENT_TYPES:
                return Response({"detail": f"未知事件类型：{etype}。", "accepted": accepted},
                                status=http.HTTP_400_BAD_REQUEST)
            if etype == "itemResolved":
                score = payload.get("score")
                if not isinstance(score, (int, float)) or not 0 <= score <= 1:
                    return Response({"detail": "itemResolved.score 必须 ∈ [0,1]。", "accepted": accepted},
                                    status=http.HTTP_400_BAD_REQUEST)
            if session.status != "active":
                return Response({"detail": f"会话已 {session.status}，拒绝新事件。", "accepted": accepted},
                                status=http.HTTP_409_CONFLICT)

            Event.objects.create(event_id=event_id, session=session, seq=seq, ts=ts, type=etype, payload=payload)
            last_seq = seq
            accepted += 1

            if etype == "activityFinished":
                # 后端裁决：以已收 itemResolved 的 score 均值重算权威总分
                scores = [e.payload["score"] for e in session.events.filter(type="itemResolved")]
                session.total_score = sum(scores) / len(scores) if scores else None
                reported = payload.get("totalScore")
                session.reported_total_score = reported if isinstance(reported, (int, float)) else None
                if (session.total_score is None) != (session.reported_total_score is None) or (
                    session.total_score is not None
                    and abs(session.total_score - session.reported_total_score) > 1e-9
                ):
                    warning = (
                        f"上报 totalScore={session.reported_total_score} 与后端权威值 "
                        f"{session.total_score} 不一致，以后端为准。"
                    )
                session.status = "finished"
                session.save()

        # resumeToken 不透明透传，存最新值
        if "resumeToken" in request.data:
            session.resume_token = request.data["resumeToken"]
            session.save(update_fields=["resume_token", "updated_at"])

        body = {"accepted": accepted, "status": session.status}
        if warning:
            body["warning"] = warning
        return Response(body)
