import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  backfillPhotos,
  confirmLogin,
  exportViewer,
  getJob,
  openBrowser,
  startExtraction,
  updateJob,
} from '../api/client';
import { Job, JobStatus, JOB_STATUS_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';
import QuestionMappingsTable from '../components/QuestionMappingsTable';
import JobCriteriaTable from '../components/JobCriteriaTable';
import CandidatesTable from '../components/CandidatesTable';
import LogsPanel from '../components/LogsPanel';

type Tab = 'mapping' | 'criteria' | 'candidates' | 'logs';

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
  const [browserActionLoading, setBrowserActionLoading] = useState(false);
  const [viewerExportLoading, setViewerExportLoading] = useState(false);
  const [viewerPassword, setViewerPassword] = useState<string | null>(null);

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

  useEffect(() => {
    if (job?.active_run?.status !== 'processing') return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.active_run?.status]);

  async function handleOpenBrowser() {
    setBrowserActionLoading(true);
    try {
      await openBrowser(jobId);
      await refresh();
      setTab('logs');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error abriendo el navegador');
    } finally {
      setBrowserActionLoading(false);
    }
  }

  async function handleConfirmLogin() {
    setBrowserActionLoading(true);
    try {
      await confirmLogin(jobId);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error confirmando el login');
    } finally {
      setBrowserActionLoading(false);
    }
  }

  async function handleStartExtraction() {
    setBrowserActionLoading(true);
    try {
      await startExtraction(jobId);
      await refresh();
      setTab('logs');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error iniciando la extracción');
    } finally {
      setBrowserActionLoading(false);
    }
  }

  async function handleExportViewer() {
    setViewerExportLoading(true);
    setViewerPassword(null);
    try {
      const password = await exportViewer(jobId);
      setViewerPassword(password);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error exportando el visualizador');
    } finally {
      setViewerExportLoading(false);
    }
  }

  async function handleBackfillPhotos() {
    setBrowserActionLoading(true);
    try {
      await backfillPhotos(jobId);
      await refresh();
      setTab('logs');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error buscando fotos pendientes');
    } finally {
      setBrowserActionLoading(false);
    }
  }

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

  const hasCandidates = (job.candidates_count ?? 0) > 0;
  const exportTitle = hasCandidates ? undefined : 'No hay candidatos para exportar todavía';
  const exportClass = `btn btn-secondary${hasCandidates ? '' : ' btn-disabled-link'}`;

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
        {!job.active_run || ['completed', 'error'].includes(job.active_run.status) ? (
          <button className="btn btn-secondary" onClick={handleOpenBrowser} disabled={browserActionLoading}>
            {browserActionLoading ? 'Abriendo...' : 'Abrir navegador'}
          </button>
        ) : job.active_run.status === 'awaiting_login' ? (
          <button className="btn" onClick={handleConfirmLogin} disabled={browserActionLoading}>
            {browserActionLoading ? 'Confirmando...' : 'Estoy logueado, continuar'}
          </button>
        ) : (
          <button className="btn btn-secondary" disabled>
            {job.active_run.status === 'opening' ? 'Abriendo navegador...' : 'Navegador abierto — login confirmado'}
          </button>
        )}

        {job.active_run?.status === 'processing' ? (
          <button className="btn btn-secondary" disabled>
            Extrayendo... ({job.active_run.processed_candidates}/{job.active_run.total_candidates})
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={handleStartExtraction}
            disabled={job.active_run?.status !== 'awaiting_extraction' || browserActionLoading}
            title={
              job.active_run?.status === 'awaiting_extraction'
                ? undefined
                : 'Requiere un navegador abierto con login confirmado'
            }
          >
            Iniciar extracción
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={handleBackfillPhotos}
          disabled={job.active_run?.status !== 'awaiting_extraction' || browserActionLoading}
          title={
            job.active_run?.status === 'awaiting_extraction'
              ? 'Repasa los candidatos ya procesados que se quedaron sin foto de perfil'
              : 'Requiere un navegador abierto con login confirmado'
          }
        >
          Buscar fotos pendientes
        </button>
        <a
          className={exportClass}
          href={hasCandidates ? `/api/jobs/${job.id}/export.csv` : undefined}
          aria-disabled={!hasCandidates}
          title={exportTitle}
        >
          Exportar CSV
        </a>
        <a
          className={exportClass}
          href={hasCandidates ? `/api/jobs/${job.id}/export.xlsx` : undefined}
          aria-disabled={!hasCandidates}
          title={exportTitle}
        >
          Exportar Excel
        </a>
        <a
          className={exportClass}
          href={hasCandidates ? `/api/jobs/${job.id}/export.zip` : undefined}
          aria-disabled={!hasCandidates}
          title={exportTitle}
        >
          Exportar ZIP
        </a>
        <button
          className="btn btn-secondary"
          onClick={handleExportViewer}
          disabled={!hasCandidates || viewerExportLoading}
          title={hasCandidates ? undefined : exportTitle}
        >
          {viewerExportLoading ? 'Generando...' : 'Exportar visualizador'}
        </button>
      </div>

      {viewerPassword && (
        <div className="card" style={{ borderColor: '#0a66c2' }}>
          <strong>Visualizador generado.</strong> Sube el ZIP descargado a una carpeta de tu
          servidor Apache (por HTTPS) y descomprímelo ahí. Contraseña de acceso (solo se muestra
          una vez, guárdala ahora):
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <code style={{ fontSize: '1.1rem', padding: '0.3rem 0.6rem', background: '#f5f6f8', borderRadius: 4 }}>
              {viewerPassword}
            </code>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigator.clipboard.writeText(viewerPassword)}
            >
              Copiar
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setViewerPassword(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

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
        <button className={`tab-btn ${tab === 'criteria' ? 'active' : ''}`} onClick={() => setTab('criteria')}>
          Criterios de evaluación
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
      {tab === 'criteria' && <JobCriteriaTable jobId={job.id} />}
      {tab === 'candidates' && <CandidatesTable jobId={job.id} activeRun={job.active_run ?? null} />}
      {tab === 'logs' && <LogsPanel activeRun={job.active_run ?? null} />}
    </div>
  );
}
