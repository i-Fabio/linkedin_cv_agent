function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/["\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  // BOM para que Excel detecte UTF-8 al abrir el CSV directamente.
  return '﻿' + lines.join('\r\n');
}
