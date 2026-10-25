import { api } from '../lib/api'
import type { Job, JobInput, JobRun } from '../types'

export async function listJobs() {
  const { data } = await api.get<Job[]>('/jobs/')
  return data
}

export async function createJob(input: JobInput) {
  const { data } = await api.post<Job>('/jobs/', input)
  return data
}

export async function getJobRuns(jobId: number) {
  const { data } = await api.get<JobRun[]>(`/jobs/${jobId}/runs/`)
  return data
}

export async function controlJob(jobId: number, action: 'pause' | 'resume' | 'cancel') {
  const { data } = await api.post<Job>(`/jobs/${jobId}/${action}/`)
  return data
}

