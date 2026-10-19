"""Course publication and explicit learner enrollment."""

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
        course = get_object_or_404(
            CourseVersion.objects.filter(status="published"), pk=course_version_id
        )
        Enrollment.objects.get_or_create(user=request.user, course_version=course)
        return Response(course_summary(course, True))
