import { db } from '../db/index.js';
import { getSession } from './browserManager.js';
import {
  parseCandidateAnswers,
  matchesQuestion,
  normalizeAnswer,
  guessFieldType,
} from './answerParser.js';
import { deriveNameFromPage, findOrCreateCandidateStub } from './candidateStore.js';

function nowIso() {
  return new Date().toISOString();
}

// Lee las preguntas de preseleccion de la pagina de candidato actualmente
// abierta y las compara contra los mapeos ya guardados, sin crear ninguno:
// es el paso previo para que el mapeo manual solo requiera elegir el campo
// interno, en vez de tener que copiar el texto de la pregunta a mano.
export async function discoverQuestionsFromCurrentPage(job) {
  const session = getSession(job.id);
  if (!session) {
    throw new Error('No hay ningun navegador abierto para esta vacante');
  }

  const pageText = await session.page.innerText('body');
  const pairs = parseCandidateAnswers(pageText);
  const mappings = db.prepare('SELECT * FROM question_mappings WHERE job_id = ?').all(job.id);

  const seen = new Set();
  const questions = [];
  for (const { question, answer } of pairs) {
    if (seen.has(question)) continue;
    seen.add(question);
    questions.push({
      question_text: question,
      sample_answer: answer,
      suggested_field_type: guessFieldType(answer),
      already_mapped: mappings.some((m) => matchesQuestion(question, m.question_text)),
    });
  }
  return questions;
}

function normalizeAnswersAgainstMappings(pairs, mappings) {
  const normalizedAnswers = {};
  for (const { question, answer } of pairs) {
    const mapping = mappings.find((m) => matchesQuestion(question, m.question_text));
    if (!mapping) continue;
    normalizedAnswers[mapping.internal_field] = normalizeAnswer(answer, mapping.field_type);
  }
  return normalizedAnswers;
}

// Re-normaliza las respuestas ya guardadas (raw_answers_json) de los
// candidatos de una vacante contra los mapeos actuales, sin volver a abrir
// LinkedIn: sirve para cuando el mapeo se crea despues de haber extraido.
export function reapplyQuestionMappings(jobId) {
  const mappings = db.prepare('SELECT * FROM question_mappings WHERE job_id = ?').all(jobId);
  const candidates = db
    .prepare('SELECT id, raw_answers_json FROM candidates WHERE job_id = ? AND raw_answers_json IS NOT NULL')
    .all(jobId);

  const update = db.prepare(
    'UPDATE candidates SET normalized_answers_json = ?, updated_at = ? WHERE id = ?'
  );
  const timestamp = nowIso();
  let updated = 0;
  for (const candidate of candidates) {
    const rawAnswers = JSON.parse(candidate.raw_answers_json);
    const pairs = Object.entries(rawAnswers).map(([question, answer]) => ({ question, answer }));
    const normalizedAnswers = normalizeAnswersAgainstMappings(pairs, mappings);
    update.run(JSON.stringify(normalizedAnswers), timestamp, candidate.id);
    updated += 1;
  }
  return { updated };
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

  // Los mapeos se crean solo a mano desde la UI: aqui unicamente se casan las
  // preguntas extraidas contra ellos, nunca se insertan nuevos.
  const mappings = db.prepare('SELECT * FROM question_mappings WHERE job_id = ?').all(job.id);

  const rawAnswers = {};
  for (const { question, answer } of pairs) {
    rawAnswers[question] = answer;
    if (!mappings.some((m) => matchesQuestion(question, m.question_text))) {
      runLogger.warn(`Pregunta sin mapeo (ignorada): "${question}"`);
    }
  }
  const normalizedAnswers = normalizeAnswersAgainstMappings(pairs, mappings);

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
