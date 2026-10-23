import os
from celery import Celery

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "schedular_backend.settings"
)

app = Celery("schedular_backend")

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()