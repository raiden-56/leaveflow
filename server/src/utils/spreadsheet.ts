import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { dayjs } from '@leaveflow/shared';

/**
 * Export/import of user-facing spreadsheets (reports, employee lists). This is
 * a file-format concern of the HTTP layer and is unrelated to the workbook
 * persistence in src/excel.
 */

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
  width?: number;
}

export interface ExportSheet<T> {
  name: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

export async function sendWorkbook(res: Response, fileName: string, sheets: ExportSheet<any>[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LeaveFlow';
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({ header: c.header, width: c.width ?? Math.max(12, c.header.length + 4) }));
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172554' } };
    });
    for (const row of sheet.rows) ws.addRow(sheet.columns.map((c) => c.value(row) ?? ''));
    if (sheet.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  }
  const safe = `${fileName}-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`.replace(/[^\w.-]/g, '_');
  sendXlsx(res, safe, new Uint8Array(await wb.xlsx.writeBuffer()));
}

/** Sends .xlsx bytes as a download (works for Express and the in-browser API). */
export function sendXlsx(res: Response, fileName: string, bytes: Uint8Array): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.end(bytes);
}

/** Reads the first worksheet of an uploaded .xlsx into objects keyed by header. */
export async function readUploadedSheet(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => (headers[col] = String(cell.text ?? '').trim()));
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const cell = row.getCell(col);
      let value: unknown = cell.value;
      if (value instanceof Date) value = value.toISOString().slice(0, 10);
      else if (value && typeof value === 'object') value = cell.text;
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      obj[h] = value ?? '';
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

/** Typed helper so column accessors infer the row type. */
export function sheet<T>(s: ExportSheet<T>): ExportSheet<T> {
  return s;
}
