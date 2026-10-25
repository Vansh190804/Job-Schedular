import { Activity, ArrowRight, CalendarClock, Clock3, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobs } from '../hooks/useJobs'
import { EmptyState, ErrorState, Loading, Page, Status } from '../components/shared'
import { formatDate, scheduleLabel, taskLabels } from '../lib/formatters'
import { getJobLifecycleStatus, isJobActive } from '../lib/jobStatus'
import type { Job, JobRun } from '../types'

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: string | number; tone: string }) {
  return (
    <div className="summary-card">
      <div className={`summary-icon ${tone}`}><Icon size={19} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  )
}

function JobRow({ job, runs }: { job: Job; runs: JobRun[] }) {
  return (
    <Link className="job-row" to={`/jobs/${job.id}`}>
      <div className="job-symbol"><Zap size={16} /></div>
      <div className="job-row-main">
        <strong>{job.name}</strong>
        <span>{taskLabels[job.task_type]} · {scheduleLabel(job)}</span>
      </div>
      <Status status={getJobLifecycleStatus(job, runs)} />
      <ArrowRight size={16} className="row-arrow" />
    </Link>
  )
}

export function DashboardPage() {
  const { jobs, runsByJob, loading, error, reload } = useJobs()
  const activeJobs = jobs.filter(job => isJobActive(job, runsByJob[job.id])).length
  const upcoming = jobs
    .filter(job => isJobActive(job, runsByJob[job.id]) && job.next_run_at)
    .sort((a, b) => new Date(a.next_run_at || 0).getTime() - new Date(b.next_run_at || 0).getTime())
    .slice(0, 4)

  return (
    <Page
      title="Overview"
      subtitle="A clear view of your scheduled work."
    >
      {error && <ErrorState message={error} retry={reload} />}
      {loading ? <Loading /> : (
        <>
          <div className="summary-grid">
            <Summary icon={Zap} label="Total jobs" value={jobs.length} tone="blue" />
            <Summary icon={Activity} label="Active schedules" value={activeJobs} tone="violet" />
            <Summary icon={CalendarClock} label="Next scheduled" value={upcoming.length ? formatDate(upcoming[0].next_run_at) : '—'} tone="amber" />
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <div><h3>Recent jobs</h3><p className="muted">Your latest schedules</p></div>
                <Link className="text-link" to="/jobs">View all <ArrowRight size={15} /></Link>
              </div>
              {jobs.length ? <div className="job-list">{jobs.slice(0, 5).map(job => <JobRow key={job.id} job={job} runs={runsByJob[job.id] || []} />)}</div> : <EmptyState title="No jobs yet" text="Create your first schedule to get started." action="Create a job" href="/jobs/new" />}
            </section>
            <section className="panel">
              <div className="panel-header">
                <div><h3>Upcoming runs</h3><p className="muted">Calculated by the scheduler</p></div>
                <Clock3 size={18} className="panel-icon" />
              </div>
              {upcoming.length ? (
                <div className="upcoming-list">
                  {upcoming.map(job => <div className="upcoming-item" key={job.id}><span className="timeline-dot" /><div><strong>{job.name}</strong><small>{formatDate(job.next_run_at)}</small></div></div>)}
                </div>
              ) : <EmptyState title="Nothing scheduled" text="Active jobs with upcoming schedules will appear here." />}
            </section>
          </div>
        </>
      )}
    </Page>
  )
}
