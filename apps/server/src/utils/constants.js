export const JOB_STATUSES = ['pending', 'in_progress', 'completed', 'error'];

export const FIELD_TYPES = ['text', 'boolean', 'number'];

export const CANDIDATE_EXTRACTION_STATUSES = [
  'pending',
  'ok',
  'error',
  'missing_pdf',
];

// Estado del candidato en el proceso de selección (módulo de análisis de CV).
// La UI muestra las etiquetas en español; en BD se guardan estos valores.
export const CANDIDATE_PROCESS_STATUSES = [
  'pending_analysis',
  'cv_unreadable',
  'analyzed',
  'preselected',
  'discarded',
  'interview_scheduled',
];

export const RUN_STATUSES = [
  'opening',
  'awaiting_login',
  'awaiting_extraction',
  'processing',
  'completed',
  'error',
];

export const INITIAL_INTERNAL_FIELDS = [
  'disponibilidad_inmediata',
  'presencial_barcelona',
  'anos_experiencia_web',
  'react_typescript',
  'expectativa_salarial',
  'cv_pdf_adjuntado',
  'backend_apis',
];
