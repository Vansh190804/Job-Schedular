import { useState } from 'react'
import { ArrowRight, CircleAlert, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import * as jobsApi from '../api/jobs'
import { apiError } from '../lib/api'
import { Page } from '../components/shared'
import type { JobInput, ScheduleType, TaskType } from '../types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function CreateJobPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [task, setTask] = useState<TaskType>('generate_report')
  const [schedule, setSchedule] = useState<ScheduleType>('one_time')
  const [runAt, setRunAt] = useState('')
  const [interval, setInterval] = useState('3600')
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!name.trim()) return setError('Give your job a name.')
    if (schedule === 'one_time' && !runAt) return setError('Choose a run date and time.')
    if (schedule === 'interval' && Number(interval) <= 0) return setError('Interval must be greater than zero.')


    const input: JobInput = {
      name: name.trim(),
      task_type: task,
      schedule_type: schedule,
      is_active: active,
      ...(schedule === 'one_time'
        ? { run_at: new Date(runAt).toISOString() }
        : { interval_seconds: Number(interval) }),
    }

    console.log('Creating job with input:', input)

    setLoading(true)
    try {
      const job = await jobsApi.createJob(input)
      navigate(`/jobs/${job.id}`)
    } catch (cause) {
      console.log('Job creation failed:', cause)
      setError(apiError(cause, 'The job could not be created.'))
    } finally {
      console.log('Finished job creation attempt')
      setLoading(false)
    }
  }

  return (
    <Page title="Create a job" subtitle="Define what should run and when." back="/jobs">
      <section className="form-panel">
        <div className="form-intro">
          <div className="summary-icon blue"><Zap size={19} /></div>
          <div><h3>Job configuration</h3><p className="muted">The scheduler will own execution and next-run calculations.</p></div>
        </div>
        {error && <div className="alert error"><CircleAlert size={17} /> {error}</div>}
        <form onSubmit={submit} className="job-form">
          <Field label="Job name"><input required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Daily revenue report" /></Field>
          <div className="form-grid">
            <Field label="Task type"><select value={task} onChange={event => setTask(event.target.value as TaskType)}><option value="generate_report">Generate report</option><option value="send_notification">Send notification</option><option value="call_webhook">Call webhook</option></select></Field>
            <Field label="Schedule type"><select value={schedule} onChange={event => setSchedule(event.target.value as ScheduleType)}><option value="one_time">One time</option><option value="interval">Interval</option></select></Field>
          </div>
          {schedule === 'one_time' ? (
            <Field label="Run at"><input type="datetime-local" required value={runAt} onChange={event => setRunAt(event.target.value)} /><small className="hint">Your local time is converted to an ISO timestamp for the API.</small></Field>
          ) : (
            <Field label="Interval (seconds)"><input type="number" min="1" required value={interval} onChange={event => setInterval(event.target.value)} /><small className="hint">The backend schedules the next run from this interval.</small></Field>
          )}
          <label className="toggle-row"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /><span className="toggle" /><span><strong>Activate immediately</strong><small>Start scheduling this job after creation.</small></span></label>
          <div className="form-actions"><Link className="button secondary" to="/jobs">Cancel</Link><button disabled={loading} className="button primary">{loading ? 'Creating…' : 'Create job'} {!loading && <ArrowRight size={17} />}</button></div>
        </form>
      </section>
    </Page>
  )
}
