import { dayjs } from '@leaveflow/shared';
import { SHEETS, defaultFor, type ColumnDef, type Row, type SheetName } from './schema.js';

const DATE_FORMATS = ['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD', 'D-M-YYYY', 'D/M/YYYY'];

/** Converts a raw cell/JSON value to the column's declared type. */
export function coerce(raw: unknown, col: ColumnDef): string | number | boolean {
  if (raw === null || raw === undefined || raw === '') return defaultFor(col);
  switch (col.type) {
    case 'number': {
      const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
      return Number.isFinite(num) ? num : 0;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      return ['true', 'yes', 'y', '1'].includes(String(raw).trim().toLowerCase());
    case 'date': {
      if (raw instanceof Date) return dayjs(raw.toISOString().slice(0, 10)).format('YYYY-MM-DD');
      const str = String(raw).trim();
      const parsed = dayjs(str, DATE_FORMATS, true);
      return parsed.isValid() ? parsed.format('YYYY-MM-DD') : str;
    }
    case 'datetime':
      if (raw instanceof Date) return raw.toISOString();
      return String(raw).trim();
    default: {
      const str = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).trim();
      return col.enum ? str.toUpperCase() : str;
    }
  }
}

/** Normalises a record to the sheet's column types (and drops unknown keys). */
export function coerceRow(sheet: SheetName, record: Record<string, unknown>): Row {
  const out: Row = {};
  for (const col of SHEETS[sheet].columns) {
    const value = record[col.key];
    out[col.key] =
      typeof value === 'boolean' && col.type === 'boolean'
        ? value
        : typeof value === 'number' && col.type === 'number'
          ? value
          : coerce(value as unknown, col);
  }
  return out;
}
