export const JOB_STATUSES = ['pending', 'in_progress', 'completed', 'error'];

export const FIELD_TYPES = ['text', 'boolean', 'number'];

export const CANDIDATE_EXTRACTION_STATUSES = [
  'pending',
  'ok',
  'error',
  'missing_pdf',
];

// Estados de una extraction_run. A partir de la Fase 3 solo se usan los
// relacionados con la apertura del navegador y confirmacion de login; el
// resto (processing/completed por extraccion real) llegan en fases 4-6.
export const RUN_STATUSES = [
  'opening',
  'awaiting_login',
  'awaiting_extraction',
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
