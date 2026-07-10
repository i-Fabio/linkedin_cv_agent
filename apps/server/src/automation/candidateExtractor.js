import { db } from '../db/index.js';
import { getSession } from './browserManager.js';
import {
  parseCandidateAnswers,
  guessFieldType,
  slugifyField,
  normalizeAnswer,
} from './answerParser.js';
import { deriveNameFromPage, findOrCreateCandidateStub } from './candidateStore.js';

function nowIso() {
  return new Date().toISOString();
}

// Busca el mapeo existente para una pregunta o crea uno nuevo sugerido
// (Fase 4: "Detectar preguntas y sugerir mapeo").
function findOrCreateMapping(jobId, question, answer, mappingByQuestion) {
  const existing = mappingByQuestion.get(question);
  if (existing) return existing;

  const fieldType = guessFieldType(answer);
  const internalField = slugifyField(question) || `campo_${mappingByQuestion.size + 1}`;
  const timestamp = nowIso();

  db.prepare(
    `INSERT OR IGNORE INTO question_mappings (job_id, question_text, internal_field, field_type, is_required, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(jobId, question, internalField, fieldType, timestamp, timestamp);

  const mapping = db
    .prepare('SELECT * FROM question_mappings WHERE job_id = ? AND question_text = ?')
    .get(jobId, question);
  mappingByQuestion.set(question, mapping);
  return mapping;
}

export async function extractCurrentCandidate(job, { fallbackName = null } = {}) {
  const session = getSession(job.id);
  if (!session) {
    throw new Error('No hay ningun navegador abierto para esta vacante');
  }

  const { page, runLogger } = session;
  const pageText = await page.innerText('body');
  const profileUrl = page.url();

  const pairs = parseCandidateAnswers(pageText);
  runLogger.info(`Extraidas ${pairs.length} respuestas de preseleccion de ${profileUrl}`);

  if (pairs.length === 0) {
    runLogger.warn('No se encontro el bloque de respuestas de preseleccion en la pagina actual');
  }

  const existingMappings = db.prepare('SELECT * FROM question_mappings WHERE job_id = ?').all(job.id);
  const mappingByQuestion = new Map(existingMappings.map((m) => [m.question_text, m]));

  const rawAnswers = {};
  const normalizedAnswers = {};

  for (const { question, answer } of pairs) {
    const wasKnown = mappingByQuestion.has(question);
    const mapping = findOrCreateMapping(job.id, question, answer, mappingByQuestion);
    if (!wasKnown) {
      runLogger.info(
        `Nueva pregunta detectada, mapeo sugerido: "${question}" -> ${mapping.internal_field} (${mapping.field_type})`
      );
    }
    rawAnswers[question] = answer;
    normalizedAnswers[mapping.internal_field] = normalizeAnswer(answer, mapping.field_type);
  }

  const derivedName = (await deriveNameFromPage(page)) ?? fallbackName;
  const candidate = findOrCreateCandidateStub(job.id, profileUrl, derivedName);

  // COALESCE: si en este pase se derivo un nombre valido, sustituye al que
  // hubiera (p. ej. el titulo generico de la pestana guardado por versiones
  // anteriores); si no, conserva el existente.
  db.prepare(
    `UPDATE candidates
     SET name = COALESCE(?, name), raw_answers_json = ?, normalized_answers_json = ?, extraction_status = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    derivedName,
    JSON.stringify(rawAnswers),
    JSON.stringify(normalizedAnswers),
    candidate.pdf_path ? 'ok' : 'missing_pdf',
    nowIso(),
    candidate.id
  );

  runLogger.info(`Candidato guardado (id ${candidate.id})`);
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate.id);
}
