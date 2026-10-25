from datetime import timedelta
from unittest.mock import patch
from types import SimpleNamespace

from django.test import TestCase
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.db import IntegrityError, transaction

from jobs.models import Job, JobRun, DispatchOutbox
from jobs.schedular import dispatch_due_jobs, dispatch_pending_outbox

from jobs.tasks import execute_job
from jobs.schedular import recover_stale_runs

from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework import status



class SchedulerTests(TestCase):
    def setUp(self):
       User = get_user_model()
       self.user = User.objects.create_user(
            username="testuser",
            password="test-password-123",
       )

       self.client = APIClient()
       self.client.force_authenticate(user=self.user)

    def create_one_time_job(self, **overrides):
        scheduled_time = timezone.now() - timedelta(seconds=5)

        defaults = {
            "owner": self.user,
            "name": "Test One-Time Job",
            "task_type": Job.TaskType.GENERATE_REPORT,
            "schedule_type": Job.ScheduleType.ONE_TIME,
            "run_at": scheduled_time,
            "next_run_at": scheduled_time,
            "is_active": True,
        }
        defaults.update(overrides)

        return Job.objects.create(**defaults)


    def test_due_one_time_job_creates_run_and_outbox(self):
        job = self.create_one_time_job()

        result = dispatch_due_jobs.apply().get()

        job.refresh_from_db()

        self.assertEqual(result["created"], 1)
        self.assertIsNone(job.next_run_at)

        run = JobRun.objects.get(job=job)
        self.assertEqual(run.status, JobRun.Status.PENDING)

        outbox = DispatchOutbox.objects.get(run=run)
        self.assertEqual(
            outbox.status,
            DispatchOutbox.Status.PENDING,
        )


    def test_future_job_is_not_dispatched(self):
        job = self.create_one_time_job(
            run_at=timezone.now() + timedelta(hours=1),
            next_run_at=timezone.now() + timedelta(hours=1),
        )

        result = dispatch_due_jobs.apply().get()

        self.assertEqual(result["created"], 0)
        self.assertFalse(JobRun.objects.filter(job=job).exists())
        self.assertFalse(
            DispatchOutbox.objects.filter(run__job=job).exists()
        )


    def test_interval_schedule_preserves_original_cadence(self):
        now = timezone.now()
        interval = 60
        scheduled_time = now - timedelta(
            seconds=2 * interval + 20
        )

        job = Job.objects.create(
            owner = self.user,
            name="Interval Cadence Test",
            task_type=Job.TaskType.GENERATE_REPORT,
            schedule_type=Job.ScheduleType.INTERVAL,
            interval_seconds=interval,
            next_run_at=scheduled_time,
            is_active=True,
        )

        result = dispatch_due_jobs.apply().get()

        job.refresh_from_db()

        self.assertEqual(result["created"], 1)
        self.assertGreater(job.next_run_at, timezone.now())

        elapsed = (
            job.next_run_at - scheduled_time
        ).total_seconds()

        # The next scheduled time must remain aligned
        # to the original interval cadence.
        self.assertAlmostEqual(
            elapsed % interval,
            0,
            delta=0.01,
        )

        self.assertEqual(JobRun.objects.filter(job=job).count(), 1)


    def test_duplicate_message_for_completed_run_is_ignored(self):
      job = self.create_one_time_job()

      run = JobRun.objects.create(
        job=job,
        scheduled_at=timezone.now(),
        status=JobRun.Status.SUCCESS,
        finished_at=timezone.now(),
      )

      result = execute_job.apply(
         args=(job.id, run.id)
      ).get()

      self.assertEqual(result["status"], "duplicate_ignored")

      run.refresh_from_db()
      self.assertEqual(run.status, JobRun.Status.SUCCESS)


    def test_cancelled_job_does_not_execute(self):
      job = self.create_one_time_job(
        is_active=False,
        cancelled_at=timezone.now(),
      )

      run = JobRun.objects.create(
        job=job,
        scheduled_at=timezone.now(),
        status=JobRun.Status.PENDING,
      )

      result = execute_job.apply(
        args=(job.id, run.id)
      ).get()

      run.refresh_from_db()

      self.assertEqual(result["status"], "skipped")
      self.assertEqual(run.status, JobRun.Status.FAILED)


    def test_stale_running_run_is_marked_failed(self):
      job = self.create_one_time_job()

      run = JobRun.objects.create(
        job=job,
        scheduled_at=timezone.now(),
        status=JobRun.Status.RUNNING,
        started_at=timezone.now() - timedelta(minutes=20),
        last_attempt_started_at=(
            timezone.now() - timedelta(minutes=20)
        ),
      )

      result = recover_stale_runs.apply().get()

      run.refresh_from_db()

      self.assertGreaterEqual(result["recovered"], 1)
      self.assertEqual(run.status, JobRun.Status.FAILED)
      self.assertIsNotNone(run.finished_at)


    
    def test_failed_job_retries_and_eventually_fails(self):
      # An unsupported task type deliberately triggers an exception.
      job = self.create_one_time_job(task_type="unsupported_task")

      run = JobRun.objects.create(
        job=job,
        scheduled_at=timezone.now(),
        status=JobRun.Status.PENDING,
      )

      # throw=False prevents the final exception from escaping the test.
      result = execute_job.apply(
        args=(job.id, run.id),
        throw=False,
      )

      run.refresh_from_db()

      self.assertEqual(run.status, JobRun.Status.FAILED)
      self.assertEqual(run.attempt, 4)
      self.assertNotEqual(run.error_message, "")
      self.assertIsNotNone(run.finished_at)


    def test_duplicate_scheduled_run_is_rejected(self):
        job = self.create_one_time_job()

        scheduled_at = job.next_run_at

        JobRun.objects.create(
          job=job,
          scheduled_at=scheduled_at,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
              JobRun.objects.create(
                job=job,
                scheduled_at=scheduled_at,
              )


    def test_outbox_remains_pending_when_redis_dispatch_fails(self):
        job = self.create_one_time_job()

        dispatch_due_jobs()

        outbox = DispatchOutbox.objects.get(run__job=job)

        # simulating fake redis conn failure
        with patch(
          "jobs.schedular.execute_job.apply_async",
           side_effect=ConnectionError("Redis unavailable"),
        ):
           dispatch_pending_outbox()

        outbox.refresh_from_db()

        self.assertEqual(
           outbox.status,
           DispatchOutbox.Status.PENDING,
        )
        self.assertEqual(outbox.attempt, 1)
        self.assertIn("Redis unavailable", outbox.last_error)


    def test_pending_outbox_can_be_dispatched_later(self):
       job = self.create_one_time_job()
       dispatch_due_jobs()

       outbox = DispatchOutbox.objects.get(run__job=job)

       # Redis is unavailable.
       with patch(
         "jobs.schedular.execute_job.apply_async",
         side_effect=ConnectionError("Redis unavailable"),
        ):
            dispatch_pending_outbox()

       # publishing succeeds.
       with patch(
          "jobs.schedular.execute_job.apply_async",
          return_value=SimpleNamespace(id="test-task-id"),
        ):
           dispatch_pending_outbox()

       outbox.refresh_from_db()
       outbox.run.refresh_from_db()

       self.assertEqual(outbox.status, DispatchOutbox.Status.SENT)
       self.assertEqual(outbox.attempt, 2)
       self.assertIsNotNone(outbox.sent_at)
       self.assertEqual(outbox.run.celery_task_id, "test-task-id")



class JobAPITests(APITestCase):
    def test_list_jobs(self):
        response = self.client.get("/api/jobs/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)


    def test_create_one_time_job(self):
        run_at = timezone.now() + timedelta(minutes=5)

        payload = {
            "name": "API Test Job",
            "task_type": "generate_report",
            "schedule_type": "one_time",
            "run_at": run_at.isoformat(),
        }

        response = self.client.post(
            "/api/jobs/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        self.assertEqual(response.data["name"], "API Test Job")
        self.assertEqual(response.data["schedule_type"], "one_time")

        job = Job.objects.get(name="API Test Job")
        self.assertIsNotNone(job.next_run_at)


    def test_create_one_time_job_without_run_at_fails(self):
        payload = {
            "name": "Invalid Job",
            "task_type": "generate_report",
            "schedule_type": "one_time",
        }

        response = self.client.post(
            "/api/jobs/",
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(Job.objects.filter(name="Invalid Job").exists())


    def setUp(self):
     User = get_user_model()

     self.user = User.objects.create_user(
        username="testuser",
        password="test-password-123",
     )

     self.client.force_authenticate(user=self.user)
     
     self.job = Job.objects.create(
        owner = self.user,
        name="API Control Test",
        task_type=Job.TaskType.GENERATE_REPORT,
        schedule_type=Job.ScheduleType.ONE_TIME,
        run_at=timezone.now() + timedelta(minutes=5),
        next_run_at=timezone.now() + timedelta(minutes=5),
        is_active=True,
     )

 
    def test_list_job_runs(self):
     run = JobRun.objects.create(
        job=self.job,
        scheduled_at=timezone.now(),
        status=JobRun.Status.SUCCESS,
        finished_at=timezone.now(),
     )

     response = self.client.get(f"/api/jobs/{self.job.id}/runs/")

     self.assertEqual(response.status_code, status.HTTP_200_OK)
     self.assertEqual(len(response.data), 1)
     self.assertEqual(response.data[0]["id"], run.id)


    def test_pause_job(self):
     response = self.client.post(f"/api/jobs/{self.job.id}/pause/")

     self.assertEqual(response.status_code, status.HTTP_200_OK)

     self.job.refresh_from_db()
     self.assertFalse(self.job.is_active)


    def test_resume_job(self):
      self.job.is_active = False
      self.job.save(update_fields=["is_active"])

      response = self.client.post(f"/api/jobs/{self.job.id}/resume/")

      self.assertEqual(response.status_code, status.HTTP_200_OK)

      self.job.refresh_from_db()
      self.assertTrue(self.job.is_active)
      self.assertIsNone(self.job.cancelled_at)


    def test_cancel_job(self):
      response = self.client.post(f"/api/jobs/{self.job.id}/cancel/")

      self.assertEqual(response.status_code, status.HTTP_200_OK)

      self.job.refresh_from_db()
      self.assertFalse(self.job.is_active)
      self.assertIsNotNone(self.job.cancelled_at)


    
    def test_get_runs_for_unknown_job_returns_404(self):
       response = self.client.get("/api/jobs/999999/runs/")

       self.assertEqual(
         response.status_code,
         status.HTTP_404_NOT_FOUND,
        )


    def test_pause_unknown_job_returns_404(self):
       response = self.client.post("/api/jobs/999999/pause/")

       self.assertEqual(
         response.status_code,
         status.HTTP_404_NOT_FOUND,
        )


    def test_cancelled_job_cannot_be_resumed(self):
       self.job.is_active = False
       self.job.cancelled_at = timezone.now()
       self.job.save(update_fields=["is_active", "cancelled_at"])

       response = self.client.post(
          f"/api/jobs/{self.job.id}/resume/"
       )

       self.job.refresh_from_db()

       self.assertEqual(
         response.status_code,
         status.HTTP_400_BAD_REQUEST,
       )
       self.assertFalse(self.job.is_active)
       self.assertIsNotNone(self.job.cancelled_at)


    def test_user_cannot_see_another_users_job(self):
      other_user = get_user_model().objects.create_user(
          username="other_user",
          password="test-password-123",
      )

      other_job = Job.objects.create(
        owner=other_user,
        name="Private Job",
        task_type=Job.TaskType.GENERATE_REPORT,
        schedule_type=Job.ScheduleType.ONE_TIME,
        run_at=timezone.now() + timedelta(hours=1),
        next_run_at=timezone.now() + timedelta(hours=1),
      )

      response = self.client.get(
        f"/api/jobs/{other_job.id}/runs/"
      )

      print(response)

      self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


    def test_user_registration(self):
        payload = {
            "email": "testuser@example.com",
            "password": "StrongPassword123!",
            "password_confirm": "StrongPassword123!"
        }

        res = self.client.post("/api/auth/register/", data=payload)

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        payload = {
            "email": "testuser@example.com",
            "password": "StrongPassword123!",
            "password_confirm": "StrongPassword123!"
        }

        res = self.client.post("/api/auth/register/", data=payload)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["email"][0], "An account with this email already exists.")

        payload = {
           "email": "testUser2@example.com",
           "password": "StrongPassword123!",
           "password_confirm": "StrongPassword321!"
        }

        res= self.client.post("/api/auth/register/", data=payload)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["password_confirm"][0], "Passwords do not match.")

        payload = {
           "email": "InvalidEmail",
           "password": "StrongPassword123!",
           "password_confirm": "StrongPassword123!"
        }

        res= self.client.post("/api/auth/register/", data=payload)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        payload = {
           "email": "testUser123@gmail.com",
           "password": "weak",
           "password_confirm": "weak"
        }

        res= self.client.post("/api/auth/register/", data=payload)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


    def test_user_login(self):
        payload = {
           "email": "testuser@example.com",
           "password": "StrongPassword123!",
           "password_confirm": "StrongPassword123!"
        }

        res = self.client.post("/api/auth/register/", data=payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        payload = {
           "email": "testuser@example.com",
           "password": "StrongPassword123!"
        }

        res = self.client.post("/api/token/", data=payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        payload = {
           "email": "testuser@example.com",
           "password": "WrongPassword!"
        }

        res = self.client.post("/api/token/", data=payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"][0], "Invalid email or password.")

        payload = {
           "email": "wrongEmail@gmail.com",
           "password": "StrongPassword123!"
        }

        res = self.client.post("/api/token/", data=payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["detail"][0], "Invalid email or password.")

        payload = {
           "email": "testuser@example.com"
        }

        res = self.client.post("/api/token/", data=payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)



User = get_user_model()
class GoogleTokenExchangeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="google_test_user",
            email="googleuser@example.com",
            password="TestPassword123!",
        )

        self.exchange_url = reverse("google-token-exchange")

    @patch("jobs.views.cache.delete")
    @patch("jobs.views.cache.get")
    def test_valid_google_code_returns_jwt_tokens(
        self, mock_cache_get, mock_cache_delete
    ):
        # Simulate a temporary code that belongs to this user.
        mock_cache_get.return_value = self.user.pk

        response = self.client.post(
            self.exchange_url,
            {"code": "valid-temporary-google-code"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        # Confirm the access token belongs to the expected user.
        access_token = AccessToken(response.data["access"])
        self.assertEqual(
            str(access_token["user_id"]),
            str(self.user.pk),
        )

        # Confirm the refresh token is valid too.
        RefreshToken(response.data["refresh"])

        mock_cache_delete.assert_called_once()

    @patch("jobs.views.cache.get")
    def test_invalid_google_code_is_rejected(self, mock_cache_get):
        mock_cache_get.return_value = None

        response = self.client.post(
            self.exchange_url,
            {"code": "invalid-or-expired-code"},
            format="json",
        )

        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED],
        )

        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)