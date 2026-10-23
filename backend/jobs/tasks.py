from django.utils import timezone
from django.db import transaction

from celery import shared_task
from .models import Job, JobRun

# celery detects tasks file in the Django app we create on running the tasks as .delay()
@shared_task
def add_numbers(a, b):
    result = a + b
    print(f"Background task executed: {a} + {b} = {result}")

    return result


@shared_task(bind=True, max_retries=3)
def execute_job(self, job_id, run_id):
    try: 
        # to prevent duplicate job runs to diff workers
        with transaction.atomic():
            run = (
                JobRun.objects
                .select_for_update()
                .select_related("job")
                .get(id=run_id)
            )

            expected_attempts = self.request.retries + 1

            if run.status in [
                JobRun.Status.SUCCESS,
                JobRun.Status.FAILED,
                JobRun.Status.RUNNING,
            ]:
                return {"status": "duplicate_ignored", "run_id": run_id}

            # first attempt, 2 workers gets the same job run
            if self.request.retries == 0:
                if run.status != JobRun.Status.PENDING:
                    return {"status": "duplicate_ignored", "run_id": run_id}

            # when retry is also duplicated to 2 workers
            else:
                if (run.status != JobRun.Status.RETRY_WAIT or  
                    run.attempt != self.request.retries   # stale out of order retry (not the duplication problem)
                   ):
                     return {"status": "duplicate_ignored", "run_id": run_id}

            now = timezone.now()

            if run.started_at is None:
                run.started_at = now

            run.status = JobRun.Status.RUNNING
            run.attempt = expected_attempts
            run.last_attempt_started_at = now

            run.save(update_fields=["status", "attempt", "started_at", "last_attempt_started_at"])   
                
    except JobRun.DoesNotExist:
        return {"status": "not-found", "job_id": run_id}

    job = run.job

    if not job.is_active or job.cancelled_at is not None:
        run.status = JobRun.Status.FAILED
        run.error_message = "Job was paused or cancelled before execution."
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error_message", "finished_at"])  

        return {"status": "skipped", "reason":"Job is not active or cancelled."}

    run.status = JobRun.Status.RUNNING
    run.attempt = self.request.retries + 1

    if run.started_at is None:
        run.started_at = timezone.now()

    run.save(update_fields=["status", "started_at", "attempt"])

    try:
      if job.task_type == Job.TaskType.GENERATE_REPORT:
         print(f"Generating report for job: {job.name}")

      elif job.task_type == Job.TaskType.SEND_NOTIFICATION:
         print(f"Sending notification for job: {job.name}")

      elif job.task_type == Job.TaskType.CALL_WEBHOOK:
         print(f"Calling webhook for job: {job.name}")

      else:
         raise ValueError(f"Unknown task type: {job.task_type}")
    
    except Exception as e:
        run.error_message = str(e)

        if self.request.retries < self.max_retries:

            run.status = JobRun.Status.RETRY_WAIT
            run.save(update_fields=["attempt", "status", "error_message"])

            delay = 2 ** (self.request.retries + 1)

            raise self.retry(
                exc = e,
                countdown = delay
            )

        run.status = JobRun.Status.FAILED
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error_message", "finished_at"])
        raise


    run.status = JobRun.Status.SUCCESS
    run.error_message = ""  
    run.finished_at = timezone.now()
    run.save(update_fields=["status", "finished_at"])

    return {"status": "success", "job_id": job_id, "run_id": run_id, "attempt": run.attempt}


    