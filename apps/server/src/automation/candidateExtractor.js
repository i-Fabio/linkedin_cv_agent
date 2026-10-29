import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { getSession } from './browserManager.js';
import {
  parseCandidateAnswers,
  matchesQuestion,
  normalizeAnswer,
  guessFieldType,
} from './answerParser.js';
import {
  deriveNameFromPage,
  derivePublicProfileUrlFromPage,
  derivePhotoUrlFromPage,
  findOrCreateCandidateStub,
} from './candidateStore.js';
import { normalizeFilename } from '../utils/normalizeFilename.js';

function nowIso() {
  return new Date().toISOString();
}

const PHOTO_EXT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Nota: la miniatura de la lista viene en 100x100 y LinkedIn incrusta ese
// tamaño en la URL (".../profile-displayphoto-shrink_100_100/..."), pero NO
// es intercambiable por uno mayor cambiando el numero: cada tamaño tiene su
// propio token firmado (parametro `t=`) y pedir un tamaño distinto al
// firmado devuelve 403 (confirmado en pruebas reales el 2026-09-16). No hay
// forma de conseguir una resolucion mayor sin que LinkedIn exponga esa URL
// firmada en el DOM, y no lo hace en esta vista.

// Descarga la foto de perfil vía el contexto del navegador (comparte cookies
// de sesión, asi que funciona tanto si el CDN de LinkedIn exige auth como si
// no). Solo se llama una vez por candidato (ver COALESCE en el UPDATE de
// extractCurrentCandidate); un fallo aqui nunca aborta la extraccion.
export async function downloadCandidatePhoto(context, job, candidate, photoUrl) {
  try {
    const response = await context.request.get(photoUrl);
    if (!response.ok()) return null;

    const contentType = (response.headers()['content-type'] || 'image/jpeg').split(';')[0].trim();
    const ext = PHOTO_EXT_BY_CONTENT_TYPE[contentType] || 'jpg';
    const baseName = candidate.name ? normalizeFilename(candidate.name) : `candidato_${candidate.id}`;
    const fileName = `${baseName}_${candidate.id}.${ext}`;
    const photosDir = path.join(job.download_dir, 'photos');
    fs.mkdirSync(photosDir, { recursive: true });
    const targetPath = path.join(photosDir, fileName);
    fs.writeFileSync(targetPath, await response.body());

    return { fileName: `photos/${fileName}`, targetPath };
  } catch {
    return null;
  }
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

export async function extractCurrentCandidate(job, { fallbackName = null, knownPhotoUrl = null } = {}) {
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
  const publicProfileUrl = await derivePublicProfileUrlFromPage(page);
  const candidate = findOrCreateCandidateStub(job.id, profileUrl, derivedName);

  // La foto solo se descarga una vez por candidato (evita golpear el CDN en
  // cada re-extraccion); si ya hay una guardada se deja tal cual. Se prefiere
  // `knownPhotoUrl` (recolectado de antemano recorriendo la lista paginada,
  // ver candidateListRunner.js) porque la miniatura del candidato solo existe
  // en el DOM mientras su fila esta cargada/paginada en la lista lateral; si
  // se navega directo a su URL esa fila puede no estar renderizada y
  // derivePhotoUrlFromPage (que depende de la fila "active") no encuentra nada.
  let photo = null;
  if (!candidate.photo_path) {
    const photoUrl = knownPhotoUrl ?? (await derivePhotoUrlFromPage(page));
    if (photoUrl) {
      photo = await downloadCandidatePhoto(session.context, job, candidate, photoUrl);
      if (photo) runLogger.info(`Foto de perfil descargada: ${photo.fileName}`);
    }
  }

  // COALESCE: si en este pase se derivo un nombre/perfil publico/foto valido,
  // sustituye al que hubiera; si no, conserva el existente.
  db.prepare(
    `UPDATE candidates
     SET name = COALESCE(?, name), public_profile_url = COALESCE(?, public_profile_url),
         photo_filename = COALESCE(?, photo_filename), photo_path = COALESCE(?, photo_path),
         raw_answers_json = ?, normalized_answers_json = ?, extraction_status = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    derivedName,
    publicProfileUrl,
    photo?.fileName ?? null,
    photo?.targetPath ?? null,
    JSON.stringify(rawAnswers),
    JSON.stringify(normalizedAnswers),
    candidate.pdf_path ? 'ok' : 'missing_pdf',
    nowIso(),
    candidate.id
  );

  runLogger.info(`Candidato guardado (id ${candidate.id})`);
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate.id);
}
