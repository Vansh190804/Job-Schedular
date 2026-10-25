export type TaskType = 'generate_report' | 'send_notification' | 'call_webhook'
export type ScheduleType = 'one_time' | 'interval'
export type JobRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'retry_wait'
export type JobLifecycleStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface User {
  id: number
  username: string
  email: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface Job {
  id: number
  name: string
  task_type: TaskType
  schedule_type: ScheduleType
  run_at: string | null
  interval_seconds: number | null
  next_run_at: string | null
  is_active: boolean
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface JobRun {
  id: number
  job: number
  scheduled_at: string
  started_at: string | null
  finished_at: string | null
  status: JobRunStatus
  error_message: string
  celery_task_id: string | null
  attempt: number
  created_at: string
}

export interface JobInput {
  name: string
  task_type: TaskType
  schedule_type: ScheduleType
  run_at?: string
  interval_seconds?: number
  is_active: boolean
}
