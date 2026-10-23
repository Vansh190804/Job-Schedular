from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .models import Job, JobRun, DispatchOutbox
from django.db import transaction
from .tasks import execute_job

@shared_task
def dispatch_due_jobs():
    now = timezone.now()
    created = 0

    # treating db as a transaction, either all jobs are dispatched or none, changes are rolled back in case of error
    with transaction.atomic():
      due_jobs = Job.objects.filter(
        is_active=True,
        next_run_at__lte=now,
        next_run_at__isnull=False,
      ).select_for_update() # for database lock so two scheduler process do not pick the same job at same time


      for job in due_jobs:
        scheduled_at = job.next_run_at 

        run = JobRun.objects.create(
           job = job,
           scheduled_at = scheduled_at,
           status = JobRun.Status.PENDING,
        )

        DispatchOutbox.objects.create(run = run)

        if job.schedule_type == Job.ScheduleType.ONE_TIME:
            job.next_run_at = None
        else:
            interval = job.interval_seconds
            next_run = scheduled_at + timedelta(seconds=interval)   

            # prevent schedule drift, if job starts at 10:00 but scheduler runs at 10:05, and say interval is 10 min, so
            # next run would be 10:15, but it should have been 10:10, from original schedule, so we skip missed intervals 
            # in between and preserve original schedule time which was 10:00 + 10 = 10:10 by this logic
            if next_run <= now:
               missed_intervals = (
                  int((now - scheduled_at).total_seconds() // interval) + 1
               ) 

               next_run += timedelta(seconds = missed_intervals * interval)

            job.next_run_at = next_run

        job.save(update_fields=["next_run_at"])
        created += 1

    print(f"Created {created} jobs at {now}.")
    return {"created": created}




# created outbox bcz after transaction commit, if redis connection fails, the job run is created in postgre, but the work 
# never reached celery, so for dispatching, we use another schedular, when job run is created, dispath is created in outbox
# and if redis connection fails, the dispath is still there as PENDING, so we can execute that job whose run is created but its 
# not dispatched
@shared_task
def dispatch_pending_outbox():
    pending_ids = list(
       DispatchOutbox.objects.filter(
          status = DispatchOutbox.Status.PENDING
       )
       .order_by("created_at")
       .values_list("id", flat=True)[:100]
    )

    dispatched = 0

    for outbox_id in pending_ids:
        # locking database record to prevent multiple workers from dispatching same job run
        # if dispatch is locked, skip rather than waiting
        with transaction.atomic():
           outbox = (
              DispatchOutbox.objects
              .select_for_update(skip_locked=True)
              .filter(
                 id = outbox_id,
                 status = DispatchOutbox.Status.PENDING
              )
              .select_related("run")
              .first()
           )

           if outbox is None:
              continue

           try:
                task = execute_job.apply_async(
                    args=(outbox.run.job_id, outbox.run_id)
                )

                JobRun.objects.filter(
                    id=outbox.run_id
                ).update(celery_task_id=task.id)

                outbox.status = DispatchOutbox.Status.SENT
                outbox.attempt += 1
                outbox.last_error = ""
                outbox.sent_at = timezone.now()
                outbox.save(
                    update_fields=[
                        "status",
                        "attempt",
                        "last_error",
                        "sent_at",
                    ]
                )

                dispatched += 1

           except Exception as exc:
                outbox.attempt += 1
                outbox.last_error = str(exc)
                outbox.save(
                    update_fields=["attempt", "last_error"]
                )

                print(
                    f"Failed to dispatch run "
                    f"{outbox.run_id}: {exc}"
                )
                    
    print(f"Dispatched {dispatched} jobs from outbox at {timezone.now()}.")
    return {"dispatched": dispatched}






# what if the celery recieves the work , job is running but then server crashes? 
# in postgre its still running, running job will never go to worker again, so we need to re-try jobs 
# which are running for too long
@shared_task
def recover_stale_runs():
    cutoff = timezone.now() - timedelta(minutes=15)

    stale_runs = JobRun.objects.filter(
       status = JobRun.Status.RUNNING,
       last_attempt_started_at__lt = cutoff,
       finished_at__isnull = True
    )

    recovered = stale_runs.update(
       status = JobRun.Status.FAILED,
       finished_at = timezone.now(),
       error_message = "Job run failed due to worker crash or timeout.",
    )

    print(f"Recovered {recovered} stale job runs at {timezone.now()}.")

    return {"recovered": recovered}

