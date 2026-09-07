import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  downloadCurrentCandidatePdf,
  extractCurrentCandidate,
  listCandidates,
  listQuestionMappings,
} from '../api/client';
import { Candidate, ExtractionRun, QuestionMapping } from '../types';
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

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return String(value);
}

type ColumnType = 'text' | 'number' | 'boolean' | 'status' | 'pdf' | 'none';

interface Column {
  key: string;
  label: string;
  type: ColumnType;
  title?: string;
  getValue: (candidate: Candidate) => unknown;
}

interface SortCriterion {
  key: string;
  dir: 'asc' | 'desc';
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

// Filtros numéricos: "30000", ">=30000", "<5"... Si la expresión está a medio
// escribir (p. ej. solo ">"), no se filtra nada para no vaciar la tabla.
function matchesNumberFilter(value: unknown, filter: string): boolean {
  const match = filter.trim().match(/^(>=|<=|>|<)?\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return true;
  if (isEmptyValue(value)) return false;
  const num = Number(value);
  if (Number.isNaN(num)) return false;
  const target = Number(match[2].replace(',', '.'));
  switch (match[1]) {
    case '>':
      return num > target;
    case '<':
      return num < target;
    case '>=':
      return num >= target;
    case '<=':
      return num <= target;
    default:
      return num === target;
  }
}

function matchesFilter(column: Column, candidate: Candidate, filter: string): boolean {
  const value = column.getValue(candidate);
  switch (column.type) {
    case 'boolean':
      return filter === 'si' ? value === true : value === false;
    case 'number':
      return matchesNumberFilter(value, filter);
    case 'status':
      return value === filter;
    case 'pdf':
      return filter === 'con' ? !isEmptyValue(value) : isEmptyValue(value);
    case 'text':
      return normalizeText(formatAnswer(value)).includes(normalizeText(filter));
    default:
      return true;
  }
}

function compareByColumn(column: Column, a: Candidate, b: Candidate): number {
  const av = column.getValue(a);
  const bv = column.getValue(b);
  const aEmpty = isEmptyValue(av);
  const bEmpty = isEmptyValue(bv);
  // Los valores vacíos van siempre al final, suba o baje el orden.
  if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? Infinity : -Infinity;

  if (column.type === 'number') return Number(av) - Number(bv);
  if (column.type === 'boolean') return Number(av === true) - Number(bv === true);
  const as = column.type === 'status' ? STATUS_LABELS[String(av)] ?? String(av) : String(av);
  const bs = column.type === 'status' ? STATUS_LABELS[String(bv)] ?? String(bv) : String(bv);
  return as.localeCompare(bs, 'es', { sensitivity: 'base', numeric: true });
}

export default function CandidatesTable({ jobId, activeRun }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mappings, setMappings] = useState<QuestionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  async function refreshQuietly() {
    try {
      const [data, maps] = await Promise.all([listCandidates(jobId), listQuestionMappings(jobId)]);
      setCandidates(data);
      setMappings(maps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando candidatos');
    }
  }

  async function refresh() {
    setLoading(true);
    await refreshQuietly();
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (activeRun?.status !== 'processing') return;
    const interval = setInterval(refreshQuietly, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.status]);

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

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadCurrentCandidatePdf(jobId);
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error descargando el CV');
    } finally {
      setDownloading(false);
    }
  }

  const canExtract = activeRun?.status === 'awaiting_extraction';

  const columns: Column[] = useMemo(
    () => [
      { key: 'name', label: 'Nombre', type: 'text', getValue: (c) => c.name },
      { key: 'profile', label: 'Perfil', type: 'none', getValue: () => null },
      { key: 'status', label: 'Estado', type: 'status', getValue: (c) => c.extraction_status },
      { key: 'pdf', label: 'PDF', type: 'pdf', getValue: (c) => c.pdf_filename },
      ...mappings.map<Column>((mapping) => ({
        key: `field:${mapping.internal_field}`,
        label: mapping.internal_field,
        title: mapping.question_text,
        type: mapping.field_type,
        getValue: (c) => c.normalized_answers_json?.[mapping.internal_field],
      })),
    ],
    [mappings]
  );

  const visibleCandidates = useMemo(() => {
    const activeFilters = columns
      .map((column) => ({ column, filter: filters[column.key]?.trim() ?? '' }))
      .filter(({ column, filter }) => filter !== '' && column.type !== 'none');

    const filtered = candidates.filter((candidate) =>
      activeFilters.every(({ column, filter }) => matchesFilter(column, candidate, filter))
    );

    if (sortCriteria.length === 0) return filtered;

    const columnByKey = new Map(columns.map((column) => [column.key, column]));
    return [...filtered].sort((a, b) => {
      for (const { key, dir } of sortCriteria) {
        const column = columnByKey.get(key);
        if (!column) continue;
        const cmp = compareByColumn(column, a, b);
        if (cmp === Infinity || cmp === -Infinity) return cmp === Infinity ? 1 : -1;
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }, [candidates, columns, filters, sortCriteria]);

  function handleSort(key: string, additive: boolean) {
    setSortCriteria((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        // asc -> desc -> quitar
        if (existing.dir === 'asc') {
          return prev.map((c) => (c.key === key ? { ...c, dir: 'desc' as const } : c));
        }
        return prev.filter((c) => c.key !== key);
      }
      const criterion: SortCriterion = { key, dir: 'asc' };
      return additive ? [...prev, criterion] : [criterion];
    });
  }

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const hasActiveFilters = Object.values(filters).some((value) => value.trim() !== '');

  function renderSortIndicator(key: string) {
    const index = sortCriteria.findIndex((c) => c.key === key);
    if (index === -1) return <span className="sort-indicator sort-indicator-idle">↕</span>;
    return (
      <span className="sort-indicator">
        {sortCriteria[index].dir === 'asc' ? '▲' : '▼'}
        {sortCriteria.length > 1 && <sup>{index + 1}</sup>}
      </span>
    );
  }

  function renderFilter(column: Column) {
    const value = filters[column.key] ?? '';
    switch (column.type) {
      case 'none':
        return null;
      case 'boolean':
        return (
          <select
            className="filter-input"
            value={value}
            onChange={(e) => setFilter(column.key, e.target.value)}
          >
            <option value="">Todos</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        );
      case 'status':
        return (
          <select
            className="filter-input"
            value={value}
            onChange={(e) => setFilter(column.key, e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        );
      case 'pdf':
        return (
          <select
            className="filter-input"
            value={value}
            onChange={(e) => setFilter(column.key, e.target.value)}
          >
            <option value="">Todos</option>
            <option value="con">Con PDF</option>
            <option value="sin">Sin PDF</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="text"
            className="filter-input"
            value={value}
            placeholder="p. ej. >=30000"
            onChange={(e) => setFilter(column.key, e.target.value)}
          />
        );
      default:
        return (
          <input
            type="text"
            className="filter-input"
            value={value}
            placeholder="Filtrar"
            onChange={(e) => setFilter(column.key, e.target.value)}
          />
        );
    }
  }

  return (
    <div className="card">
      <h2>Candidatos</h2>
      <p className="muted">
        Puedes extraer candidatos uno a uno: navega hasta su página en el navegador abierto y
        pulsa "Extraer candidato actual" / "Descargar CV". O usa "Iniciar extracción" en la
        cabecera de la vacante para procesar toda la lista automáticamente.
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
        <button
          className="btn btn-secondary"
          onClick={handleDownloadPdf}
          disabled={!canExtract || downloading}
          title={canExtract ? undefined : 'Requiere un navegador abierto con login confirmado'}
        >
          {downloading ? 'Descargando...' : 'Descargar CV'}
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
        <>
          <p className="muted table-meta">
            {hasActiveFilters
              ? `${visibleCandidates.length} de ${candidates.length} candidatos`
              : `${candidates.length} candidatos`}
            {' · '}Clic en una cabecera para ordenar; Mayús+clic para añadir otro criterio.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) =>
                    column.type === 'none' ? (
                      <th key={column.key}>{column.label}</th>
                    ) : (
                      <th
                        key={column.key}
                        className="th-sortable"
                        title={column.title ?? column.label}
                        onClick={(e) => handleSort(column.key, e.shiftKey)}
                      >
                        {column.label} {renderSortIndicator(column.key)}
                      </th>
                    )
                  )}
                  <th></th>
                </tr>
                <tr className="filter-row">
                  {columns.map((column) => (
                    <th key={column.key}>{renderFilter(column)}</th>
                  ))}
                  <th>
                    {hasActiveFilters && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setFilters({})}>
                        Limpiar
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1}>
                      <div className="empty-state">Ningún candidato coincide con los filtros.</div>
                    </td>
                  </tr>
                ) : (
                  visibleCandidates.map((candidate) => (
                    <Fragment key={candidate.id}>
                      <tr>
                        <td>{candidate.name ?? '—'}</td>
                        <td>
                          {candidate.linkedin_profile_url ? (
                            <a
                              href={candidate.linkedin_profile_url}
                              target="_blank"
                              rel="noreferrer"
                            >
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
                        {mappings.map((mapping) => (
                          <td key={mapping.id}>
                            {formatAnswer(candidate.normalized_answers_json?.[mapping.internal_field])}
                          </td>
                        ))}
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
                          <td colSpan={columns.length + 1}>
                            {candidate.raw_answers_json &&
                            Object.keys(candidate.raw_answers_json).length > 0 ? (
                              <dl className="answers-list">
                                {Object.entries(candidate.raw_answers_json).map(
                                  ([question, answer]) => (
                                    <div className="answers-item" key={question}>
                                      <dt>{question}</dt>
                                      <dd>{formatAnswer(answer)}</dd>
                                    </div>
                                  )
                                )}
                              </dl>
                            ) : (
                              <p className="muted">Este candidato no tiene respuestas extraídas.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
