import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJob, updateJob } from '../api/client';
import { Job, JobStatus, JOB_STATUS_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';
import QuestionMappingsTable from '../components/QuestionMappingsTable';
import CandidatesTable from '../components/CandidatesTable';
import LogsPanel from '../components/LogsPanel';

type Tab = 'mapping' | 'candidates' | 'logs';

const STATUS_OPTIONS: JobStatus[] = ['pending', 'in_progress', 'completed', 'error'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('mapping');

  const [name, setName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [status, setStatus] = useState<JobStatus>('pending');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getJob(jobId);
      setJob(data);
      setName(data.name);
      setLinkedinUrl(data.linkedin_url);
      setStatus(data.status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando vacante');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateJob(jobId, {
        name: name.trim(),
        linkedin_url: linkedinUrl.trim(),
        status,
      });
      setJob(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando cambios');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !job) {
    return <div className="empty-state">Cargando...</div>;
  }

  if (!job) {
    return (
      <div>
        <Link to="/" className="back-link">
          ← Volver a vacantes
        </Link>
        <div className="error-banner">{error ?? 'Vacante no encontrada'}</div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/" className="back-link">
        ← Volver a vacantes
      </Link>

      <div className="page-header">
        <div>
          <h1>{job.name}</h1>
          <StatusBadge status={job.status} label={JOB_STATUS_LABELS[job.status]} />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="actions-row">
        <button className="btn btn-secondary" disabled title="Disponible a partir de la Fase 3">
          Abrir navegador
        </button>
        <button className="btn btn-secondary" disabled title="Disponible a partir de la Fase 3">
          Iniciar extracción
        </button>
        <button className="btn btn-secondary" disabled title="Disponible a partir de la Fase 7">
          Exportar CSV
        </button>
        <button className="btn btn-secondary" disabled title="Disponible a partir de la Fase 7">
          Exportar Excel
        </button>
        <button className="btn btn-secondary" disabled title="Disponible a partir de la Fase 7">
          Exportar ZIP
        </button>
      </div>

      <div className="card">
        <h2>Datos de la vacante</h2>
        <form className="job-form" onSubmit={handleSave}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="name">Nombre interno</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field" style={{ maxWidth: 200 }}>
              <label htmlFor="status">Estado</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="linkedin_url">URL de LinkedIn</label>
            <input
              id="linkedin_url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Carpeta de descarga</label>
            <p className="muted">
              <code>{job.download_dir}</code>
            </p>
          </div>
          <div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'mapping' ? 'active' : ''}`} onClick={() => setTab('mapping')}>
          Mapeo de preguntas
        </button>
        <button
          className={`tab-btn ${tab === 'candidates' ? 'active' : ''}`}
          onClick={() => setTab('candidates')}
        >
          Candidatos
        </button>
        <button className={`tab-btn ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          Logs
        </button>
      </div>

      {tab === 'mapping' && <QuestionMappingsTable jobId={job.id} />}
      {tab === 'candidates' && <CandidatesTable jobId={job.id} />}
      {tab === 'logs' && <LogsPanel lastRunAt={job.last_run_at} />}
    </div>
  );
}
