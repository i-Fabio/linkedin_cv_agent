import fs from 'node:fs';
import { ZipArchive } from 'archiver';
import { rowsToCsv } from '../utils/csv.js';
import { buildExportData } from './exportData.js';

// Escribe el ZIP directamente en la response: candidatos.csv + carpeta cv/
// con los PDFs descargados de la vacante (Fase 5).
export function streamZipExport(job, res) {
  const { headers, rows } = buildExportData(job.id);
  const csv = rowsToCsv(headers, rows);

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.destroy(err);
  });

  archive.pipe(res);
  archive.append(csv, { name: 'candidatos.csv' });

  if (job.download_dir && fs.existsSync(job.download_dir)) {
    archive.directory(job.download_dir, 'cv');
  }

  archive.finalize();
}
