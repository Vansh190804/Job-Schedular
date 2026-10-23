from django.db import models
from django.conf import settings

# Create your models here.
class Job(models.Model):

    class TaskType(models.TextChoices):
        GENERATE_REPORT = "generate_report", "Generate Report"
        SEND_NOTIFICATION = "send_notification", "Send Notification"
        CALL_WEBHOOK = "call_webhook", "Call Webhook"

    class ScheduleType(models.TextChoices):
        ONE_TIME = "one_time", "One Time"
        INTERVAL = "interval", "Interval"

    name = models.CharField(max_length=200)

    task_type = models.CharField(
        max_length=50,
        choices=TaskType.choices,
    )

    schedule_type = models.CharField(
        max_length=20,
        choices=ScheduleType.choices,
    )

    run_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    interval_seconds = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    next_run_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )

    is_active = models.BooleanField(default=True)

    cancelled_at = models.DateTimeField(null=True, blank=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jobs"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name



class JobRun(models.Model):

    class Status(models.TextChoices):
          PENDING = "pending","Pending"
          RUNNING = "running","Running"
          SUCCESS = "success","Success"   
          FAILED = "failed","Failed"
          RETRY_WAIT = "retry_wait", "Waiting for retry"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="runs")

    scheduled_at = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    celery_task_id = models.CharField(max_length=255, null=True, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    last_attempt_started_at = models.DateTimeField(null=True, blank=True)

    attempt = models.PositiveIntegerField(default=1)
    error_message = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "scheduled_at"],
                name="unique_job_run_schedule"
            )
        ]

    def __str__(self):
        return f"{self.job.name} - {self.status}"




class DispatchOutbox(models.Model):

    class Status(models.TextChoices):
         PENDING = "pending","Pending"
         SENT = "sent","Sent"


    run = models.OneToOneField(JobRun, on_delete=models.CASCADE, related_name="dispatch_outbox")

    status = models.CharField(
        choices = Status.choices,
        max_length=20,
        default=Status.PENDING
    )

    attempt = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"DispatchOutbox for JobRun {self.run.id} - {self.status}"



class GoogleAccount(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="google_account",
    )

    google_sub = models.CharField(max_length=255, unique=True)
    email = models.EmailField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email