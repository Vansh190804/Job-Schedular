# Job Scheduler

A job scheduling system built to understand how background jobs are scheduled, dispatched, executed, and recovered in a distributed environment.

## Why I Built This Project

I built this project to understand the internal working of a **job scheduler** and the system design challenges involved in executing background tasks reliably.

I wanted to explore what happens when multiple schedulers process jobs concurrently, Redis becomes unavailable, workers crash during execution, or tasks fail and need to be retried. The goal was to move beyond basic task scheduling and understand the engineering principles behind reliable background processing.

## Tech Stack

- **Frontend:** React
- **Backend:** Django, Django REST Framework
- **Database:** PostgreSQL
- **Message Broker:** Redis
- **Task Queue:** Celery
- **Containerization:** Docker

## Key Features & Engineering Concepts

### 1. Job Scheduling and Execution

Implemented job scheduling with support for one-time and recurring jobs, execution tracking, and next-run calculations. Job definitions are stored separately from individual execution records.

### 2. Preventing Duplicate Scheduling

Explored PostgreSQL transactions and row-level locking to prevent multiple scheduler instances from claiming the same due jobs simultaneously. Database constraints provide additional protection against duplicate execution records.

### 3. Reliable Dispatch with the Transactional Outbox Pattern

Implemented the outbox approach to address failures between PostgreSQL and Redis. Job execution records and outbox entries are persisted together, allowing pending dispatches to be retried if Redis is temporarily unavailable.

### 4. Idempotency and Retry Handling

Implemented failure simulation and bounded retries, with a maximum of three execution attempts according to the retry policy. Explored idempotency to prevent duplicate business effects when tasks are retried or delivered more than once.

### 5. Stale Run Recovery

Explored recovering executions that remain in the `RUNNING` state for too long because of worker failures. Recovery logic helps prevent jobs from remaining stuck indefinitely.

### 6. Concurrency Management

Studied concurrency across scheduler instances, dispatchers, and workers. Applied database-level coordination and execution-state checks to handle overlapping schedules and reduce race conditions.

### 7. Testing

Applied automated testing to validate API behavior, job scheduling, execution states, retries, and failure-handling logic. Focused on testing failure scenarios and concurrency-related edge cases, not just successful execution.

## What I Learned

- Designing background job scheduling systems using Django and Celery.
- Using PostgreSQL transactions, row-level locks, and database constraints.
- Understanding Redis as a message broker.
- Applying the transactional outbox pattern for reliable message dispatch.
- Handling retries, idempotency, and worker failures.
- Recovering stale executions and managing concurrent tasks.
- Writing automated tests for application behavior and failure scenarios.

## Running the Backend

Docker configuration is available for the backend.

From the directory containing the Compose file, run:

```bash
docker compose up --build
```
Make the necessary migrations to the database

```bash
docker compose exec app python manage.py migrate
```

To stop the services:

```bash
docker compose down
```
