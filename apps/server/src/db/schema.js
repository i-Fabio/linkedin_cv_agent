export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  download_dir TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT
);

CREATE TABLE IF NOT EXISTS question_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  UNIQUE(job_id, question_text)
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  name TEXT,
  linkedin_profile_url TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  pdf_filename TEXT,
  pdf_path TEXT,
  raw_answers_json TEXT,
  normalized_answers_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extraction_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  total_candidates INTEGER DEFAULT 0,
  processed_candidates INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  log_path TEXT,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_mappings_job_id ON question_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_job_id ON extraction_runs(job_id);
`;
