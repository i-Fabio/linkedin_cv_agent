import type { Candidate, ExtractionRun, Job, QuestionMapping } from '../types';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = (body && body.error) || `Error ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

// Jobs
export const listJobs = () => request<Job[]>('/jobs');
export const getJob = (id: number) => request<Job>(`/jobs/${id}`);
export const createJob = (data: { name: string; linkedin_url: string }) =>
  request<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) });
export const updateJob = (id: number, data: Partial<Job>) =>
  request<Job>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteJob = (id: number) => request<void>(`/jobs/${id}`, { method: 'DELETE' });
export const openBrowser = (id: number) =>
  request<{ run: ExtractionRun; reused: boolean }>(`/jobs/${id}/open-browser`, { method: 'POST' });
export const confirmLogin = (id: number) =>
  request<{ run: ExtractionRun }>(`/jobs/${id}/confirm-login`, { method: 'POST' });
export const extractCurrentCandidate = (id: number) =>
  request<Candidate>(`/jobs/${id}/extract-current-candidate`, { method: 'POST' });
export const downloadCurrentCandidatePdf = (id: number) =>
  request<Candidate>(`/jobs/${id}/download-current-candidate-pdf`, { method: 'POST' });
export const startExtraction = (id: number) =>
  request<{ run: ExtractionRun }>(`/jobs/${id}/start-extraction`, { method: 'POST' });

// Question mappings
export const listQuestionMappings = (jobId: number) =>
  request<QuestionMapping[]>(`/jobs/${jobId}/question-mappings`);
export const createQuestionMapping = (
  jobId: number,
  data: { question_text: string; internal_field: string; field_type: string; is_required?: boolean }
) =>
  request<QuestionMapping>(`/jobs/${jobId}/question-mappings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateQuestionMapping = (id: number, data: Partial<QuestionMapping>) =>
  request<QuestionMapping>(`/question-mappings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
export const deleteQuestionMapping = (id: number) =>
  request<void>(`/question-mappings/${id}`, { method: 'DELETE' });

export function subscribeToRunEvents(
  runId: number,
  handlers: { onLog?: (line: string) => void; onStatus?: (status: string) => void }
): () => void {
  const source = new EventSource(`/api/runs/${runId}/events`);
  if (handlers.onLog) {
    source.addEventListener('log', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      handlers.onLog!(data.line);
    });
  }
  if (handlers.onStatus) {
    source.addEventListener('status', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      handlers.onStatus!(data.status);
    });
  }
  return () => source.close();
}

// Candidates
export const listCandidates = (jobId: number) =>
  request<Candidate[]>(`/jobs/${jobId}/candidates`);
export const getCandidate = (id: number) => request<Candidate>(`/candidates/${id}`);
export const updateCandidate = (id: number, data: Partial<Candidate>) =>
  request<Candidate>(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
