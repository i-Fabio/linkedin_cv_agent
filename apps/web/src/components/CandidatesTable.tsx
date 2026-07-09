import { Fragment, useEffect, useState } from 'react';
import { ApiError, extractCurrentCandidate, listCandidates } from '../api/client';
import { Candidate, ExtractionRun } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  jobId: number;
  activeRun: ExtractionRun | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  ok: 'OK',
  error: 'Error',
  missing_pdf: 'Sin PDF',
};

export default function CandidatesTable({ jobId, activeRun }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listCandidates(jobId);
      setCandidates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando candidatos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleExtract() {
    setExtracting(true);
    try {
      await extractCurrentCandidate(jobId);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error extrayendo el candidato actual');
    } finally {
      setExtracting(false);
    }
  }

  const canExtract = activeRun?.status === 'awaiting_extraction';

  return (
    <div className="card">
      <h2>Candidatos</h2>
      <p className="muted">
        Navega hasta la página de un candidato en el navegador abierto y pulsa "Extraer candidato
        actual" para leer sus respuestas de preselección. La descarga de PDF y el recorrido
        automático de la lista llegan en fases siguientes.
      </p>

      <div className="actions-row">
        <button
          className="btn btn-secondary"
          onClick={handleExtract}
          disabled={!canExtract || extracting}
          title={canExtract ? undefined : 'Requiere un navegador abierto con login confirmado'}
        >
          {extracting ? 'Extrayendo...' : 'Extraer candidato actual'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : candidates.length === 0 ? (
        <div className="empty-state">
          Todavía no hay candidatos extraídos para esta vacante.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Perfil</th>
              <th>Estado</th>
              <th>PDF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <Fragment key={candidate.id}>
                <tr>
                  <td>{candidate.name ?? '—'}</td>
                  <td>
                    {candidate.linkedin_profile_url ? (
                      <a href={candidate.linkedin_profile_url} target="_blank" rel="noreferrer">
                        Ver perfil
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={candidate.extraction_status}
                      label={STATUS_LABELS[candidate.extraction_status]}
                    />
                  </td>
                  <td>{candidate.pdf_filename ?? '—'}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setExpandedId(expandedId === candidate.id ? null : candidate.id)
                      }
                    >
                      {expandedId === candidate.id ? 'Ocultar' : 'Ver respuestas'}
                    </button>
                  </td>
                </tr>
                {expandedId === candidate.id && (
                  <tr>
                    <td colSpan={5}>
                      <div className="field-row">
                        <div className="field">
                          <label>Respuestas brutas</label>
                          <pre className="logs-box">
                            {JSON.stringify(candidate.raw_answers_json, null, 2)}
                          </pre>
                        </div>
                        <div className="field">
                          <label>Campos normalizados</label>
                          <pre className="logs-box">
                            {JSON.stringify(candidate.normalized_answers_json, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
