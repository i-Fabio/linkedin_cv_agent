import { FormEvent, useEffect, useState } from 'react';
import {
  createJobCriterion,
  deleteJobCriterion,
  listJobCriteria,
  updateJobCriterion,
} from '../api/client';
import { CriterionType, CRITERION_TYPE_LABELS, JobCriterion } from '../types';

interface Props {
  jobId: number;
}

const CRITERION_TYPES: CriterionType[] = ['must_have', 'nice_to_have'];

const emptyForm = {
  name: '',
  type: 'must_have' as CriterionType,
  weight: 0,
  description: '',
};

export default function JobCriteriaTable({ jobId }: Props) {
  const [criteria, setCriteria] = useState<JobCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function refresh() {
    setLoading(true);
    try {
      setCriteria(await listJobCriteria(jobId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando criterios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const niceToHave = criteria.filter((c) => c.type === 'nice_to_have');
  const weightSum = niceToHave.reduce((sum, c) => sum + c.weight, 0);
  const weightsOk = niceToHave.length === 0 || weightSum === 100;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await createJobCriterion(jobId, {
        name: form.name.trim(),
        type: form.type,
        weight: form.type === 'nice_to_have' ? form.weight : 0,
        description: form.description.trim() || null,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando criterio');
    }
  }

  function startEdit(criterion: JobCriterion) {
    setEditingId(criterion.id);
    setEditForm({
      name: criterion.name,
      type: criterion.type,
      weight: criterion.weight,
      description: criterion.description ?? '',
    });
  }

  async function handleSaveEdit(id: number) {
    try {
      await updateJobCriterion(id, {
        name: editForm.name.trim(),
        type: editForm.type,
        weight: editForm.type === 'nice_to_have' ? editForm.weight : 0,
        description: editForm.description.trim() || null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando criterio');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este criterio de evaluación?')) return;
    try {
      await deleteJobCriterion(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando criterio');
    }
  }

  return (
    <div className="card">
      <h2>Criterios de evaluación</h2>
      <p className="muted">
        Definen qué busca el análisis IA en cada CV. Los <strong>imprescindibles</strong> son
        eliminatorios si no se cumplen; los <strong>valorables</strong> suman puntos según su peso
        (deben sumar 100 entre todos).
      </p>

      {error && <div className="error-banner">{error}</div>}

      <form className="mapping-form" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
        <div className="field-row">
          <div className="field">
            <label>Criterio</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Experiencia en React y TypeScript"
              required
            />
          </div>
          <div className="field" style={{ maxWidth: 170 }}>
            <label>Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as CriterionType })}
            >
              {CRITERION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CRITERION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 110 }}>
            <label>Peso</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.weight}
              disabled={form.type !== 'nice_to_have'}
              title={form.type !== 'nice_to_have' ? 'El peso solo aplica a criterios valorables' : undefined}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="field">
          <label>Qué debe buscar el modelo en el CV (opcional)</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Al menos 2 años de experiencia demostrable con React en proyectos reales"
          />
        </div>
        <div>
          <button className="btn" type="submit">
            Añadir criterio
          </button>
        </div>
      </form>

      {niceToHave.length > 0 && (
        <p style={{ fontWeight: 600, color: weightsOk ? 'inherit' : '#b45309' }}>
          Suma de pesos valorables: {weightSum}/100
          {!weightsOk && ' — ajusta los pesos para que sumen exactamente 100 antes de analizar'}
        </p>
      )}

      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : criteria.length === 0 ? (
        <div className="empty-state">Todavía no hay criterios definidos para esta vacante.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Criterio</th>
              <th>Tipo</th>
              <th>Peso</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) =>
              editingId === criterion.id ? (
                <tr key={criterion.id}>
                  <td>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm({ ...editForm, type: e.target.value as CriterionType })
                      }
                    >
                      {CRITERION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CRITERION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      style={{ maxWidth: 80 }}
                      value={editForm.weight}
                      disabled={editForm.type !== 'nice_to_have'}
                      onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => handleSaveEdit(criterion.id)}>
                      Guardar
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={criterion.id}>
                  <td>{criterion.name}</td>
                  <td>{CRITERION_TYPE_LABELS[criterion.type]}</td>
                  <td>{criterion.type === 'nice_to_have' ? criterion.weight : '—'}</td>
                  <td className="muted">{criterion.description ?? ''}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(criterion)}>
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(criterion.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
