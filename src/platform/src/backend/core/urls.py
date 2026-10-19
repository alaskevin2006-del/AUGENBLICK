from django.urls import path

from . import auth_views, dev_views, views, catalog_views, records_views

urlpatterns = [
    path("history/", records_views.HistoryView.as_view()),
    path("history/<uuid:session_id>/", records_views.HistoryDetailView.as_view()),
    path("difficulties/", records_views.DifficultiesView.as_view()),
    path(
        "courses/<str:course_version_id>/unenroll/",
        records_views.UnenrollCourseView.as_view(),
    ),
    path("health/", views.HealthView.as_view()),
    path("auth/login/", auth_views.LoginView.as_view()),
    path("auth/logout/", auth_views.LogoutView.as_view()),
    path("auth/me/", auth_views.MeView.as_view()),
    path("dev/courses/upload/", dev_views.CourseUploadView.as_view()),
    path("courses/", views.CourseListView.as_view()),
    path("dev/courses/", catalog_views.DeveloperCourseListView.as_view()),
    path(
        "dev/courses/<str:course_version_id>/publish/",
        catalog_views.PublishCourseView.as_view(),
    ),
    path(
        "dev/courses/<str:course_version_id>/unpublish/",
        catalog_views.UnpublishCourseView.as_view(),
    ),
    path(
        "courses/<str:course_version_id>/setup/",
        catalog_views.CourseSetupView.as_view(),
    ),
    path("my-courses/", catalog_views.MyCoursesView.as_view()),
    path(
        "courses/<str:course_version_id>/enroll/",
        catalog_views.EnrollCourseView.as_view(),
    ),
    path("courses/<str:course_version_id>/payload/", views.CoursePayloadView.as_view()),
    path("sessions/", views.SessionListView.as_view()),
    path("sessions/<uuid:session_id>/", views.SessionDetailView.as_view()),
    path("sessions/<uuid:session_id>/events/", views.SessionEventsView.as_view()),
    path("sessions/<uuid:session_id>/answer/", views.SessionAnswerView.as_view()),
    path("sessions/<uuid:session_id>/next/", views.SessionNextView.as_view()),
    path("sessions/<uuid:session_id>/finish/", views.SessionFinishView.as_view()),
    path("sessions/<uuid:session_id>/skip/", views.SessionSkipView.as_view()),
]
