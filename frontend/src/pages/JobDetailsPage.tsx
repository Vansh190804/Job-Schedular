import { useEffect, useState } from 'react'
import { Activity, Pause, Play, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import * as jobsApi from '../api/jobs'
import { apiError } from '../lib/api'
import { useJobs } from '../hooks/useJobs'
import { EmptyState, ErrorState, Loading, Page, Status } from '../components/shared'
import { formatDate, scheduleLabel, taskLabels } from '../lib/formatters'
import type { JobRun, JobRunStatus } from '../types'
import { getJobLifecycleStatus, isJobTerminal } from '../lib/jobStatus'

const runLabels: Record<JobRunStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  success: 'Succeeded',
  failed: 'Failed',
  retry_wait: 'Retrying',
}

function RunRow({ run }: { run: JobRun }) {
  return (
    <div className="run-row">
      <div className={`run-icon ${run.status}`}><Activity size={15} /></div>
      <div><strong>{runLabels[run.status]}</strong><small>Scheduled {formatDate(run.scheduled_at)}</small></div>
      <span className="run-time">{formatDate(run.finished_at || run.started_at)}</span>
    </div>
  )
}

export function JobDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { jobs, loading } = useJobs()
  const job = jobs.find(item => item.id === Number(id))
  const [runs, setRuns] = useState<JobRun[]>([])
  const [runsError, setRunsError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!job) return
    jobsApi.getJobRuns(job.id)
      .then(setRuns)
      .catch(cause => setRunsError(apiError(cause, 'Execution history could not be loaded.')))
  }, [job])

  if (loading) return <Page title="Job details"><Loading /></Page>
  if (!job) return <Page title="Job not found" back="/jobs"><ErrorState message="This job does not exist or you do not have access to it." retry={() => navigate('/jobs')} /></Page>
  const currentJob = job

  async function control(action: 'pause' | 'resume' | 'cancel') {
    if (action === 'cancel' && !window.confirm(`Cancel "${currentJob.name}"? This cannot be undone.`)) return
    setActionLoading(true)
    try {
      await jobsApi.controlJob(currentJob.id, action)
      navigate('/jobs')
    } catch (cause) {
      window.alert(apiError(cause))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Page title={currentJob.name} subtitle={`${taskLabels[currentJob.task_type]} · Created ${formatDate(currentJob.created_at)}`} back="/jobs" actions={
      <>
        {!isJobTerminal(currentJob, runs) && (currentJob.is_active ? <button disabled={actionLoading} className="button secondary" onClick={() => control('pause')}><Pause size={16} /> Pause</button> : <button disabled={actionLoading} className="button primary" onClick={() => control('resume')}><Play size={16} /> Resume</button>)}
        {!isJobTerminal(currentJob, runs) && <button disabled={actionLoading} className="button danger-outline" onClick={() => control('cancel')}><Trash2 size={16} /> Cancel</button>}
      </>
    }>
      <div className="detail-grid">
        <section className="panel detail-card">
          <div className="panel-header"><div><p className="eyebrow">CONFIGURATION</p><h3>Schedule details</h3></div><Status status={getJobLifecycleStatus(currentJob, runs)} /></div>
          <dl className="detail-list">
            <div><dt>Task type</dt><dd>{taskLabels[currentJob.task_type]}</dd></div>
            <div><dt>Schedule</dt><dd>{scheduleLabel(currentJob)}</dd></div>
            <div><dt>Next run</dt><dd>{formatDate(currentJob.next_run_at)}</dd></div>
            {currentJob.cancelled_at && <div><dt>Cancelled</dt><dd>{formatDate(currentJob.cancelled_at)}</dd></div>}
            <div><dt>Last updated</dt><dd>{formatDate(currentJob.updated_at)}</dd></div>
          </dl>
        </section>
        <section className="panel detail-card">
          <div className="panel-header"><div><p className="eyebrow">EXECUTION HISTORY</p><h3>Recent runs</h3></div><Activity size={18} className="panel-icon" /></div>
          {runsError ? <p className="muted">{runsError}</p> : runs.length ? <div className="runs-list">{runs.map(run => <RunRow key={run.id} run={run} />)}</div> : <EmptyState title="No runs yet" text="The scheduler will record executions here." />}
        </section>
      </div>
    </Page>
  )
}
