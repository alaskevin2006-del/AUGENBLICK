from django.urls import path

from . import auth_views, dev_views, views

urlpatterns = [
    path("auth/login/", auth_views.LoginView.as_view()),
    path("auth/logout/", auth_views.LogoutView.as_view()),
    path("auth/me/", auth_views.MeView.as_view()),
    path("dev/courses/upload/", dev_views.CourseUploadView.as_view()),
    path("courses/", views.CourseListView.as_view()),
    path("courses/<str:course_version_id>/payload/", views.CoursePayloadView.as_view()),
    path("sessions/", views.SessionListView.as_view()),
    path("sessions/<uuid:session_id>/", views.SessionDetailView.as_view()),
    path("sessions/<uuid:session_id>/events/", views.SessionEventsView.as_view()),
]
