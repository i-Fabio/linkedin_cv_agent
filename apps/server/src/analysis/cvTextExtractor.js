import fs from 'node:fs';
// Se importa el modulo interno en vez del paquete raiz: el index.js de
// pdf-parse v1 ejecuta codigo de debug al ser importado desde ESM.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { db } from '../db/index.js';

// Por debajo de este numero de caracteres el texto se considera inservible
// para el analisis (tipico de CVs escaneados como imagen sin capa OCR, donde
// pdf-parse devuelve cadena vacia o restos sueltos).
const MIN_TEXT_LENGTH = 50;

function nowIso() {
  return new Date().toISOString();
}

// Extrae el texto de un PDF de CV. Nunca lanza por problemas del PDF:
// devuelve { success, text, error } para que el llamador decida.
export async function extractCvText(pdfPath) {
  if (!pdfPath) {
    return { success: false, text: null, error: 'El candidato no tiene PDF asociado' };
  }
  if (!fs.existsSync(pdfPath)) {
    return { success: false, text: null, error: `El archivo PDF no existe: ${pdfPath}` };
  }

  let parsed;
  try {
    parsed = await pdfParse(fs.readFileSync(pdfPath));
  } catch (error) {
    return { success: false, text: null, error: `PDF ilegible o corrupto: ${error.message}` };
  }

  const text = (parsed.text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < MIN_TEXT_LENGTH) {
    return {
      success: false,
      text: text || null,
      error: 'El PDF no contiene texto extraible (posible CV escaneado como imagen, sin OCR)',
    };
  }

  return { success: true, text, error: null };
}

// Extrae el texto del CV de un candidato y lo persiste en cv_texts (upsert:
// el texto se extrae una vez y se reutiliza en cada analisis). Si falla, el
// candidato pasa a 'cv_unreadable'; si una reextraccion posterior funciona,
// vuelve a 'pending_analysis'. Otros estados (analyzed, preselected...) no se
// tocan: reextraer texto no invalida decisiones ya tomadas.
export async function saveCvTextForCandidate(candidate) {
  const result = await extractCvText(candidate.pdf_path);
  const now = nowIso();

  db.prepare(
    `INSERT INTO cv_texts (candidate_id, extracted_text, extraction_success, extraction_error, extracted_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(candidate_id) DO UPDATE SET
       extracted_text = excluded.extracted_text,
       extraction_success = excluded.extraction_success,
       extraction_error = excluded.extraction_error,
       extracted_at = excluded.extracted_at`
  ).run(candidate.id, result.text, result.success ? 1 : 0, result.error, now);

  if (!result.success) {
    db.prepare(`UPDATE candidates SET process_status = 'cv_unreadable', updated_at = ? WHERE id = ?`).run(
      now,
      candidate.id
    );
  } else if (candidate.process_status === 'cv_unreadable') {
    db.prepare(`UPDATE candidates SET process_status = 'pending_analysis', updated_at = ? WHERE id = ?`).run(
      now,
      candidate.id
    );
  }

  const cvText = db.prepare('SELECT * FROM cv_texts WHERE candidate_id = ?').get(candidate.id);
  return { result, cvText };
}
