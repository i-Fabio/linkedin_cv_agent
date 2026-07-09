import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createJob, deleteJob, listJobs } from '../api/client';
import { Job, JOB_STATUS_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function JobsListPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setJobs(await listJobs());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando vacantes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !linkedinUrl.trim()) return;
    setSubmitting(true);
    try {
      await createJob({ name: name.trim(), linkedin_url: linkedinUrl.trim() });
      setName('');
      setLinkedinUrl('');
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando vacante');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`¿Eliminar la vacante "${job.name}"? Se borrarán sus mapeos y candidatos.`)) return;
    try {
      await deleteJob(job.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando vacante');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vacantes</h1>
          <p className="muted">Configura las vacantes de LinkedIn a procesar.</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Nueva vacante'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="card">
          <h2>Nueva vacante</h2>
          <form className="job-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="name">Nombre interno</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Stack Developer"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="linkedin_url">URL de LinkedIn</label>
              <input
                id="linkedin_url"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/..."
                required
              />
            </div>
            <div>
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? 'Creando...' : 'Crear vacante'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Cargando...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">Todavía no hay vacantes. Crea la primera arriba.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Mapeos</th>
                <th>Candidatos</th>
                <th>Creada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/jobs/${job.id}`}>{job.name}</Link>
                    <div className="muted">{job.linkedin_url}</div>
                  </td>
                  <td>
                    <StatusBadge status={job.status} label={JOB_STATUS_LABELS[job.status]} />
                  </td>
                  <td>{job.question_mappings_count ?? 0}</td>
                  <td>{job.candidates_count ?? 0}</td>
                  <td className="muted">{new Date(job.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(job)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
