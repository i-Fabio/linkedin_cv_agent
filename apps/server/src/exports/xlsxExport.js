import ExcelJS from 'exceljs';

export async function buildXlsxBuffer(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Candidatos');

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(headers.map((header) => row[header]));
  }

  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  return workbook.xlsx.writeBuffer();
}
