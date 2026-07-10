import { db } from '../db/index.js';

function nowIso() {
  return new Date().toISOString();
}

// URL canonica de perfil: sin query ni fragmento. El mismo candidato aparece
// con query params distintos segun la pagina de la lista (r=, start=...), y si
// se guardara la URL completa el mismo solicitante se duplicaria entre runs.
export function canonicalProfileUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

// Titulos genericos de LinkedIn que NO son el nombre del candidato
// (el titulo de la pestana en la vista de solicitantes es
// "(22) Detalles del candidato | ..." — sin el nombre).
const INVALID_NAME_PATTERN = /detalles del candidato|candidate details|^linkedin$|^solicitantes/i;

// Limpia texto que deberia ser directamente un nombre (h1, tarjeta de la
// lista): primera linea, sin contador "(NN)" de notificaciones.
export function cleanCandidateName(raw) {
  if (!raw) return null;
  const first = raw
    .split('\n')[0]
    .replace(/^\(\d+\)\s*/, '')
    .trim();
  if (!first || first.length < 2 || first.length > 100) return null;
  if (INVALID_NAME_PATTERN.test(first)) return null;
  return first;
}

export function deriveNameFromTitle(title) {
  if (!title) return null;
  const stripped = title.replace(/^\(\d+\)\s*/, '');
  return cleanCandidateName(stripped.split(/[|–—-]/)[0]);
}

// Mejor esfuerzo para obtener el nombre real del candidato desde la pagina:
// el h1 del panel de detalle suele ser el nombre; el titulo de la pestana es
// solo un ultimo recurso porque en LinkedIn suele ser generico.
export async function deriveNameFromPage(page) {
  const h1 = await page
    .locator('h1')
    .first()
    .innerText({ timeout: 1500 })
    .catch(() => null);
  const fromH1 = cleanCandidateName(h1);
  if (fromH1) return fromH1;

  return deriveNameFromTitle(await page.title().catch(() => null));
}

export function findCandidateByProfileUrl(jobId, profileUrl) {
  return db
    .prepare('SELECT * FROM candidates WHERE job_id = ? AND linkedin_profile_url = ?')
    .get(jobId, canonicalProfileUrl(profileUrl));
}

export function findOrCreateCandidateStub(jobId, profileUrl, derivedName) {
  const canonical = canonicalProfileUrl(profileUrl);
  const existing = findCandidateByProfileUrl(jobId, canonical);
  if (existing) {
    // Aprovecha para completar el nombre si antes no se pudo derivar.
    if (derivedName && !existing.name) {
      db.prepare('UPDATE candidates SET name = ?, updated_at = ? WHERE id = ?').run(
        derivedName,
        nowIso(),
        existing.id
      );
      return db.prepare('SELECT * FROM candidates WHERE id = ?').get(existing.id);
    }
    return existing;
  }

  const timestamp = nowIso();
  const insert = db
    .prepare(
      `INSERT INTO candidates (job_id, name, linkedin_profile_url, extraction_status, raw_answers_json, normalized_answers_json, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?)`
    )
    .run(jobId, derivedName ?? null, canonical, timestamp, timestamp);

  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(insert.lastInsertRowid);
}

export function getCandidateById(id) {
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
}
