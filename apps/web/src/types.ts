export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export interface Job {
  id: number;
  name: string;
  linkedin_url: string;
  download_dir: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  candidates_count?: number;
  question_mappings_count?: number;
}

export type FieldType = 'text' | 'boolean' | 'number';

export interface QuestionMapping {
  id: number;
  job_id: number;
  question_text: string;
  internal_field: string;
  field_type: FieldType;
  is_required: 0 | 1;
  created_at: string;
  updated_at: string;
}

export type CandidateExtractionStatus = 'pending' | 'ok' | 'error' | 'missing_pdf';

export interface Candidate {
  id: number;
  job_id: number;
  name: string | null;
  linkedin_profile_url: string | null;
  extraction_status: CandidateExtractionStatus;
  pdf_filename: string | null;
  pdf_path: string | null;
  raw_answers_json: Record<string, unknown> | null;
  normalized_answers_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export const INTERNAL_FIELD_SUGGESTIONS = [
  'disponibilidad_inmediata',
  'presencial_barcelona',
  'anos_experiencia_web',
  'react_typescript',
  'expectativa_salarial',
  'cv_pdf_adjuntado',
  'backend_apis',
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  error: 'Error',
};
