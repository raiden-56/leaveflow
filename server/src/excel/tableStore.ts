import type { WorkbookInfo } from '@leaveflow/shared';
import type { SheetName } from './schema.js';

/**
 * Storage contract used by the Excel repositories. Implemented by the Node
 * `WorkbookStore` (Excel file on disk) and by the browser store used for the
 * static GitHub Pages build (workbook kept in browser storage).
 */
export interface TableStore {
  rows<T = Record<string, unknown>>(sheet: SheetName): T[];
  readonly inTransaction: boolean;
  ensureFresh(): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  nextId(sheet: SheetName): string;
}

/** Extra operations exposed through the admin "workbook" endpoints. */
export interface DataStore extends TableStore {
  info(): Promise<Omit<WorkbookInfo, 'provider'>>;
  createBackup(label?: string): Promise<string | null>;
  /** The current workbook as .xlsx bytes. */
  exportWorkbook(): Promise<Uint8Array>;
  /** A backup as .xlsx bytes (null when it does not exist). */
  readBackup(fileName: string): Promise<Uint8Array | null>;
}
