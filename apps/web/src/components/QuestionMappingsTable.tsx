import { FormEvent, useEffect, useState } from 'react';
import {
  createQuestionMapping,
  deleteQuestionMapping,
  listQuestionMappings,
  updateQuestionMapping,
} from '../api/client';
import { FieldType, INTERNAL_FIELD_SUGGESTIONS, QuestionMapping } from '../types';

interface Props {
  jobId: number;
}

const FIELD_TYPES: FieldType[] = ['text', 'boolean', 'number'];

const emptyForm = { question_text: '', internal_field: '', field_type: 'text' as FieldType, is_required: false };

export default function QuestionMappingsTable({ jobId }: Props) {
  const [mappings, setMappings] = useState<QuestionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function refresh() {
    setLoading(true);
    try {
      setMappings(await listQuestionMappings(jobId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando mapeos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.question_text.trim() || !form.internal_field.trim()) return;
    try {
      await createQuestionMapping(jobId, {
        question_text: form.question_text.trim(),
        internal_field: form.internal_field.trim(),
        field_type: form.field_type,
        is_required: form.is_required,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando mapeo');
    }
  }

  function startEdit(mapping: QuestionMapping) {
    setEditingId(mapping.id);
    setEditForm({
      question_text: mapping.question_text,
      internal_field: mapping.internal_field,
      field_type: mapping.field_type,
      is_required: Boolean(mapping.is_required),
    });
  }

  async function handleSaveEdit(id: number) {
    try {
      await updateQuestionMapping(id, {
        question_text: editForm.question_text.trim(),
        internal_field: editForm.internal_field.trim(),
        field_type: editForm.field_type,
        is_required: editForm.is_required ? 1 : 0,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando mapeo');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este mapeo de pregunta?')) return;
    try {
      await deleteQuestionMapping(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando mapeo');
    }
  }

  return (
    <div className="card">
      <h2>Mapeo de preguntas</h2>
      <p className="muted">
        Asocia cada pregunta de preselección de LinkedIn a un campo interno normalizado.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <datalist id="internal-field-suggestions">
        {INTERNAL_FIELD_SUGGESTIONS.map((field) => (
          <option key={field} value={field} />
        ))}
      </datalist>

      <form className="mapping-form" onSubmit={handleCreate} style={{ marginBottom: 20 }}>
        <div className="field-row">
          <div className="field">
            <label>Pregunta de LinkedIn</label>
            <input
              type="text"
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              placeholder="¿Tienes disponibilidad inmediata?"
              required
            />
          </div>
          <div className="field">
            <label>Campo interno</label>
            <input
              type="text"
              list="internal-field-suggestions"
              value={form.internal_field}
              onChange={(e) => setForm({ ...form, internal_field: e.target.value })}
              placeholder="disponibilidad_inmediata"
              required
            />
          </div>
          <div className="field" style={{ maxWidth: 140 }}>
            <label>Tipo</label>
            <select
              value={form.field_type}
              onChange={(e) => setForm({ ...form, field_type: e.target.value as FieldType })}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row" style={{ alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={form.is_required}
              onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
            />
            Obligatoria
          </label>
          <button className="btn" type="submit">
            Añadir mapeo
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : mappings.length === 0 ? (
        <div className="empty-state">Todavía no hay preguntas mapeadas para esta vacante.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pregunta</th>
              <th>Campo interno</th>
              <th>Tipo</th>
              <th>Obligatoria</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) =>
              editingId === mapping.id ? (
                <tr key={mapping.id}>
                  <td>
                    <input
                      type="text"
                      value={editForm.question_text}
                      onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      list="internal-field-suggestions"
                      value={editForm.internal_field}
                      onChange={(e) => setEditForm({ ...editForm, internal_field: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.field_type}
                      onChange={(e) =>
                        setEditForm({ ...editForm, field_type: e.target.value as FieldType })
                      }
                    >
                      {FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={editForm.is_required}
                      onChange={(e) => setEditForm({ ...editForm, is_required: e.target.checked })}
                    />
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => handleSaveEdit(mapping.id)}>
                      Guardar
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={mapping.id}>
                  <td>{mapping.question_text}</td>
                  <td>
                    <code>{mapping.internal_field}</code>
                  </td>
                  <td>{mapping.field_type}</td>
                  <td>{mapping.is_required ? 'Sí' : 'No'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(mapping)}>
                      Editar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(mapping.id)}>
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
