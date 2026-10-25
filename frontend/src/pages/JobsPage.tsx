import { ArrowRight, Pause, Play, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import * as jobsApi from '../api/jobs'
import { apiError } from '../lib/api'
import { useJobs } from '../hooks/useJobs'
import { EmptyState, ErrorState, Loading, Page, Status } from '../components/shared'
import { formatDate, scheduleLabel, taskLabels } from '../lib/formatters'
import type { Job } from '../types'
import { useState } from 'react'
import { getJobLifecycleStatus, isJobCancelled, isJobTerminal } from '../lib/jobStatus'

export function JobsPage() {
  const { jobs, runsByJob, loading, error, reload, setJobs } = useJobs()
  const [query, setQuery] = useState('')
  const visibleJobs = jobs.filter(job => job.name.toLowerCase().includes(query.toLowerCase()) || taskLabels[job.task_type].toLowerCase().includes(query.toLowerCase()))

  async function control(job: Job, action: 'pause' | 'resume' | 'cancel') {
    if (action === 'cancel' && !window.confirm(`Cancel "${job.name}"? This cannot be undone.`)) return
    try {
      const updated = await jobsApi.controlJob(job.id, action)
      setJobs(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item))
    } catch (cause) {
      window.alert(apiError(cause))
    }
  }

  return (
    <Page title="All jobs" subtitle={`${jobs.length} schedule${jobs.length === 1 ? '' : 's'} in your workspace.`}>
      {error && <ErrorState message={error} retry={reload} />}
      {loading ? <Loading /> : (
        <section className="panel table-panel">
          <div className="table-toolbar">
            <div className="search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search jobs…" /></div>
            <span className="muted">{visibleJobs.length} results</span>
          </div>
          {visibleJobs.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Job</th><th>Task</th><th>Schedule</th><th>Next run</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {visibleJobs.map(job => (
                    (() => {
                      const lifecycleStatus = getJobLifecycleStatus(job, runsByJob[job.id])
                      const hasFutureRun = lifecycleStatus !== 'completed' && lifecycleStatus !== 'cancelled'

                      return (
                    <tr key={job.id}>
                      <td><Link className="table-job" to={`/jobs/${job.id}`}><span className="job-symbol"><Zap size={15} /></span><strong>{job.name}</strong></Link></td>
                      <td>{taskLabels[job.task_type]}</td>
                      <td>{scheduleLabel(job)}</td>
                      <td>{hasFutureRun ? formatDate(job.next_run_at) : '—'}</td>
                      <td><Status status={lifecycleStatus} /></td>
                      <td><div className="row-actions">{!isJobTerminal(job, runsByJob[job.id]) && !isJobCancelled(job, runsByJob[job.id]) && (job.is_active ? <button title="Pause" onClick={() => control(job, 'pause')}><Pause size={15} /></button> : <button title="Resume" onClick={() => control(job, 'resume')}><Play size={15} /></button>)}<Link title="View details" to={`/jobs/${job.id}`}><ArrowRight size={15} /></Link></div></td>
                    </tr>
                      )
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title={query ? 'No matching jobs' : 'No jobs yet'} text={query ? 'Try a different search.' : 'Create your first schedule to get started.'} action={!query ? 'Create a job' : undefined} href="/jobs/new" />}
        </section>
      )}
    </Page>
  )
}
