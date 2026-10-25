import { useCallback, useEffect, useState } from 'react'
import * as jobsApi from '../api/jobs'
import { apiError } from '../lib/api'
import type { Job, JobRun } from '../types'

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runsByJob, setRunsByJob] = useState<Record<number, JobRun[]>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const nextJobs = await jobsApi.listJobs()
      const runEntries = await Promise.all(nextJobs.map(async job => {
        try {
          return [job.id, await jobsApi.getJobRuns(job.id)] as const
        } catch {
          return [job.id, []] as const
        }
      }))
      setJobs(nextJobs)
      setRunsByJob(Object.fromEntries(runEntries))
    } catch (cause) {
      setError(apiError(cause, 'Jobs could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  return { jobs, setJobs, runsByJob, loading, error, reload }
}
