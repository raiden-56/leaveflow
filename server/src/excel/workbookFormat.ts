import ExcelJS from 'exceljs';
import { SHEETS, SHEET_NAMES, defaultFor, emptyTables, type Row, type SheetName, type Tables } from './schema.js';
import { coerce } from './coerce.js';

/**
 * Pure (no file system) conversion between in-memory tables and an ExcelJS
 * workbook. Shared by the Node WorkbookStore and the browser store.
 */

const HEADER_FILL = 'FF172554';
const HEADER_FONT = 'FFFFFFFF';
const ALT_ROW_FILL = 'FFF8FAFC';

function cellPrimitive(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('result' in value) return cellPrimitive(value.result as ExcelJS.CellValue);
    if ('text' in value) return (value as { text: unknown }).text;
    return null;
  }
  return value;
}

export interface ParseWarning {
  sheet: string;
  message: string;
}

export function readSheet(ws: ExcelJS.Worksheet, name: SheetName, warnings: ParseWarning[] = []): Row[] {
  const def = SHEETS[name];
  const columnIndex = new Map<string, number>();
  ws.getRow(1).eachCell((cell, colNumber) => {
    const header = String(cellPrimitive(cell.value) ?? '').trim();
    if (header) columnIndex.set(header, colNumber);
  });

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const excelRow = ws.getRow(r);
    const row: Row = {};
    let hasValue = false;
    for (const col of def.columns) {
      const idx = columnIndex.get(col.key);
      const raw = idx ? cellPrimitive(excelRow.getCell(idx).value) : null;
      if (raw !== null && raw !== '') hasValue = true;
      row[col.key] = coerce(raw, col);
    }
    if (!hasValue) continue;
    const id = String(row[def.idField] ?? '');
    if (!id) {
      warnings.push({ sheet: name, message: `row ${r} skipped: missing ${def.idField}` });
      continue;
    }
    if (seen.has(id)) {
      warnings.push({ sheet: name, message: `row ${r} skipped: duplicate ${def.idField} "${id}"` });
      continue;
    }
    seen.add(id);
    rows.push(row);
  }
  return rows;
}

/** Reads every known sheet; missing sheets become empty tables. */
export function parseWorkbook(workbook: ExcelJS.Workbook, warnings: ParseWarning[] = []): Tables {
  const tables = emptyTables();
  for (const name of SHEET_NAMES) {
    const ws = workbook.getWorksheet(name);
    if (!ws) {
      warnings.push({ sheet: name, message: 'worksheet missing — it will be created on the next write' });
      continue;
    }
    tables[name] = readSheet(ws, name, warnings);
  }
  return tables;
}

export function buildWorkbook(tables: Tables): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LeaveFlow';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const name of SHEET_NAMES) {
    const def = SHEETS[name];
    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = def.columns.map((c) => ({ header: c.key, key: c.key, width: c.width ?? 16 }));

    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: HEADER_FONT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: 'middle' };
    });

    tables[name].forEach((row, i) => {
      const excelRow = ws.addRow(def.columns.map((c) => row[c.key] ?? defaultFor(c)));
      if (i % 2 === 1) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_FILL } };
        });
      }
    });

    // Excel-side data validation so manual edits stay consistent with the API rules.
    const lastRow = Math.max(ws.rowCount, 2) + 200;
    def.columns.forEach((col, ci) => {
      const list = col.enum?.join(',');
      const isBool = col.type === 'boolean';
      const formula = isBool ? '"TRUE,FALSE"' : list && list.length < 250 ? `"${list}"` : null;
      if (!formula && col.type !== 'number') return;
      for (let r = 2; r <= lastRow; r++) {
        const cell = ws.getCell(r, ci + 1);
        cell.dataValidation = formula
          ? { type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: 'Invalid value', error: `Allowed: ${isBool ? 'TRUE, FALSE' : list}` }
          : { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [-100000], showErrorMessage: true, error: 'Enter a number' };
      }
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: def.columns.length } };
  }
  return workbook;
}

export async function workbookToBytes(tables: Tables): Promise<Uint8Array> {
  return new Uint8Array(await buildWorkbook(tables).xlsx.writeBuffer());
}
