"""Course publication and explicit learner enrollment."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from .models import CourseVersion, Enrollment
from .views import AuthenticatedView


def course_summary(course, is_enrolled=False):
    return {
        "courseVersionId": course.pk,
        "title": course.title,
        "languageCode": course.language_code,
        "engine": course.engine,
        "itemCount": course.item_count,
        "status": course.status,
        "publishedAt": course.published_at.isoformat() if course.published_at else None,
        "isEnrolled": is_enrolled,
    }


class DeveloperCourseListView(AuthenticatedView):
    def get(self, request):
        if not request.user.is_staff:
            raise PermissionDenied("Developer access required.")
        return Response(
            [
                course_summary(c)
                for c in CourseVersion.objects.order_by(
                    "-created_at", "course_version_id"
                )
            ]
        )


class PublishCourseView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, course_version_id):
        if not request.user.is_staff:
            raise PermissionDenied("Developer access required.")
        course = get_object_or_404(
            CourseVersion.objects.select_for_update(), pk=course_version_id
        )
        if course.status != "published":
            course.status = "published"
            course.published_at = timezone.now()
            course.save(update_fields=["status", "published_at"])
        return Response(course_summary(course))


class MyCoursesView(AuthenticatedView):
    def get(self, request):
        if request.user.is_staff:
            return Response([])
        courses = CourseVersion.objects.filter(
            status="published", enrollments__user=request.user
        ).order_by("course_version_id")
        return Response([course_summary(c, True) for c in courses])


class EnrollCourseView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, course_version_id):
        if request.user.is_staff:
            raise PermissionDenied("Developers use preview instead of enrollment.")
        # Match session creation: owner then course, including FK insert locks.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        course = get_object_or_404(
            CourseVersion.objects.select_for_update().filter(status="published"),
            pk=course_version_id,
        )
        Enrollment.objects.get_or_create(user=request.user, course_version=course)
        return Response(course_summary(course, True))


class UnpublishCourseView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, course_version_id):
        if not request.user.is_staff:
            raise PermissionDenied("Developer access required.")
        course = get_object_or_404(
            CourseVersion.objects.select_for_update(), pk=course_version_id
        )
        if course.status != "draft" or course.published_at is not None:
            course.status = "draft"
            course.published_at = None
            course.save(update_fields=["status", "published_at"])
        return Response(course_summary(course))


class CourseSetupView(AuthenticatedView):
    @transaction.atomic
    def post(self, request, course_version_id):
        from rest_framework.exceptions import ValidationError
        from .selection import select_questions
        from .models import Session

        available = CourseVersion.objects.select_for_update()
        if not request.user.is_staff:
            available = available.filter(status="published")
        course = get_object_or_404(available, pk=course_version_id)
        enrolled = Enrollment.objects.filter(
            user=request.user, course_version=course
        ).exists()
        if not request.user.is_staff and not enrolled:
            raise PermissionDenied("Join this course before learning.")
        from .engines.registry import SUPPORTED
        if course.engine not in SUPPORTED:
            raise ValidationError("This engine is not available yet.")
        from .records_views import difficult_objects

        difficult_ids = (
            {key[1] for key in difficult_objects(request.user, course.pk)}
            if request.data.get("difficultOnly") is True
            else None
        )
        _, metadata, _ = select_questions(
            course.payload, request.data, difficult_object_ids=difficult_ids
        )
        return Response(
            {
                "course": course_summary(course, enrolled),
                "checkpoints": course.payload.get('checkpoints',[]),
                "testAvailable": course.engine != 'companion',
                "hasReference": bool(course.payload.get('reference')),
                **metadata,
                "testSubmitted": not request.user.is_staff
                and Session.objects.filter(
                    user=request.user,
                    course_version=course,
                    mode="T",
                    is_preview=False,
                    status="finished",
                ).exists(),
            }
        )


class CourseReferenceView(AuthenticatedView):
    def get(self,request,course_version_id):
        from .models import Session
        from rest_framework.exceptions import NotFound
        course=get_object_or_404(CourseVersion,pk=course_version_id)
        if not request.user.is_staff and (course.status!='published' or not Enrollment.objects.filter(user=request.user,course_version=course).exists()):
            raise NotFound('Course not found.')
        if Session.objects.filter(user=request.user,course_version=course,mode='T',status='active',is_preview=request.user.is_staff).exists():
            raise PermissionDenied('Reference is unavailable during a test.')
        return Response(course.payload.get('reference',{}))
