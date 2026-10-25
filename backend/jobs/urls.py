from django.urls import path
from .views import (
    JobListCreateView, 
    JobRunListView, 
    JobControlView, 
    google_login, google_callback, 
    GoogleTokenExchangeView,
    RegisterView,
)

urlpatterns = [
    path("jobs/", JobListCreateView.as_view(), name="job-list-create"),
    path(
        "jobs/<int:job_id>/runs/",
        JobRunListView.as_view(),
        name="job-run-list",
    ),
    path(
        "jobs/<int:job_id>/<str:action>/",
        JobControlView.as_view(),
        name="job-control",
    ),
    path("auth/google/", google_login, name="google-login"),
    path(
        "auth/google/callback/",
        google_callback,
        name="google-callback",
    ),
    path(
        "auth/google/exchange/",
        GoogleTokenExchangeView.as_view(),
        name="google-token-exchange",
    ),
    path(
        "auth/register/",
        RegisterView.as_view(),
        name="register",
    )
]