import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import ExcelJS from 'exceljs';
import { dayjs } from '@leaveflow/shared';
import { Mutex } from '../utils/mutex.js';
import { locked } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { SHEETS, SHEET_NAMES, emptyTables, type SheetName, type Tables } from './schema.js';
import type { DataStore } from './tableStore.js';
import { buildWorkbook, parseWorkbook, type ParseWarning } from './workbookFormat.js';

export { buildWorkbook } from './workbookFormat.js';
export { coerce } from './coerce.js';

export interface WorkbookStoreOptions {
  filePath: string;
  backupDir: string;
  backupRetention?: () => number;
  /** How often (ms) reads re-check the file for external edits. */
  freshnessCheckMs?: number;
}

/**
 * WorkbookStore owns the Excel file. It keeps an in-memory, typed copy of every
 * sheet and exposes a transactional API:
 *
 *  - Reads are served from the last committed snapshot.
 *  - Writes run inside `transaction()`. Transactions are serialised by a mutex,
 *    operate on a private working copy (via AsyncLocalStorage) and are only
 *    committed after the workbook was backed up and atomically written to disk
 *    (write temp file -> rename). If anything throws, the working copy is
 *    discarded and nothing is persisted, so the workbook can't be half-written.
 *  - External edits (someone saving the file in Excel while the server is
 *    running) are detected through the file's mtime and reloaded.
 */
export class WorkbookStore implements DataStore {
  private committed: Tables = emptyTables();
  private readonly txContext = new AsyncLocalStorage<Tables>();
  private readonly mutex = new Mutex();
  private lastKnownMtimeMs = 0;
  private lastFreshnessCheck = 0;

  constructor(private readonly options: WorkbookStoreOptions) {}

  get filePath(): string {
    return this.options.filePath;
  }

  /** Loads the workbook, creating it from `seed()` when it does not exist yet. */
  async init(seed?: () => Tables | Promise<Tables>): Promise<{ created: boolean }> {
    await fs.mkdir(path.dirname(this.options.filePath), { recursive: true });
    await fs.mkdir(this.options.backupDir, { recursive: true });
    if (!existsSync(this.options.filePath)) {
      const tables = seed ? await seed() : emptyTables();
      await this.writeFile(tables, false);
      this.committed = tables;
      logger.info(`Created new workbook at ${this.options.filePath}`);
      return { created: true };
    }
    await this.load();
    return { created: false };
  }

  /** Returns the rows of a sheet for the current context (transaction working copy or committed). */
  rows<T = Record<string, unknown>>(sheet: SheetName): T[] {
    const tx = this.txContext.getStore();
    return ((tx ?? this.committed)[sheet] ?? []) as unknown as T[];
  }

  get inTransaction(): boolean {
    return this.txContext.getStore() !== undefined;
  }

  /** Re-reads the file if it was changed by another program (throttled). */
  async ensureFresh(): Promise<void> {
    if (this.inTransaction || this.mutex.isLocked) return;
    const now = Date.now();
    if (now - this.lastFreshnessCheck < (this.options.freshnessCheckMs ?? 2000)) return;
    this.lastFreshnessCheck = now;
    await this.reloadIfChanged();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(); // nested -> join the outer transaction
    return this.mutex.runExclusive(async () => {
      await this.reloadIfChanged();
      const before = JSON.stringify(this.committed);
      const working = JSON.parse(before) as Tables;
      const result = await this.txContext.run(working, fn);
      // Skip the disk write (and backup) for read-only or no-op transactions.
      if (JSON.stringify(working) !== before) {
        await this.writeFile(working, true);
        this.committed = working;
      }
      return result;
    });
  }

  /** Generates the next sequential ID for a sheet, e.g. LV0042. Must be called inside a transaction. */
  nextId(sheet: SheetName): string {
    const def = SHEETS[sheet];
    let max = 0;
    for (const row of this.rows<Record<string, unknown>>(sheet)) {
      const id = String(row[def.idField] ?? '');
      if (!id.startsWith(def.idPrefix)) continue;
      const num = Number(id.slice(def.idPrefix.length));
      if (Number.isFinite(num) && num > max) max = num;
    }
    return `${def.idPrefix}${String(max + 1).padStart(def.idPad, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Backups & metadata
  // ---------------------------------------------------------------------------

  async createBackup(label = 'auto'): Promise<string | null> {
    if (!existsSync(this.options.filePath)) return null;
    const stamp = dayjs().format('YYYYMMDD-HHmmss-SSS');
    const base = path.basename(this.options.filePath, '.xlsx');
    const target = path.join(this.options.backupDir, `${base}-${stamp}-${label}.xlsx`);
    await fs.copyFile(this.options.filePath, target);
    await this.pruneBackups();
    return path.basename(target);
  }

  async listBackups(): Promise<{ fileName: string; sizeBytes: number; createdAt: string }[]> {
    if (!existsSync(this.options.backupDir)) return [];
    const files = (await fs.readdir(this.options.backupDir)).filter((f) => f.endsWith('.xlsx'));
    const stats = await Promise.all(
      files.map(async (fileName) => {
        const st = await fs.stat(path.join(this.options.backupDir, fileName));
        return { fileName, sizeBytes: st.size, createdAt: st.mtime.toISOString() };
      }),
    );
    return stats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async info() {
    const st = await fs.stat(this.options.filePath);
    return {
      filePath: this.options.filePath,
      sizeBytes: st.size,
      lastModified: st.mtime.toISOString(),
      sheets: SHEET_NAMES.map((name) => ({ name, rows: this.committed[name].length })),
      backups: await this.listBackups(),
    };
  }

  async exportWorkbook(): Promise<Uint8Array> {
    return new Uint8Array(await fs.readFile(this.options.filePath));
  }

  async readBackup(fileName: string): Promise<Uint8Array | null> {
    const safe = path.basename(fileName);
    const file = path.join(this.options.backupDir, safe);
    if (!safe.endsWith('.xlsx') || !existsSync(file)) return null;
    return new Uint8Array(await fs.readFile(file));
  }

  // ---------------------------------------------------------------------------
  // File IO
  // ---------------------------------------------------------------------------

  private async reloadIfChanged(): Promise<void> {
    try {
      const st = await fs.stat(this.options.filePath);
      if (st.mtimeMs > this.lastKnownMtimeMs + 1) {
        logger.info('Workbook changed on disk, reloading');
        await this.load();
      }
    } catch (err) {
      logger.warn('Could not check workbook freshness', err);
    }
  }

  private async load(): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(this.options.filePath);
    } catch (err) {
      throw new Error(`Unable to read workbook ${this.options.filePath}: ${(err as Error).message}`);
    }
    const warnings: ParseWarning[] = [];
    this.committed = parseWorkbook(workbook, warnings);
    warnings.forEach((w) => logger.warn(`${w.sheet}: ${w.message}`));
    const st = await fs.stat(this.options.filePath);
    this.lastKnownMtimeMs = st.mtimeMs;
  }

  private async writeFile(tables: Tables, backupFirst: boolean): Promise<void> {
    if (backupFirst) {
      try {
        await this.createBackup();
      } catch (err) {
        logger.warn('Backup failed, continuing with write', err);
      }
    }
    const workbook = buildWorkbook(tables);
    const tmp = `${this.options.filePath}.${process.pid}.${Date.now()}.tmp`;
    await workbook.xlsx.writeFile(tmp);
    try {
      await renameWithRetry(tmp, this.options.filePath);
    } catch (err) {
      await fs.rm(tmp, { force: true });
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        throw locked('The Excel workbook is locked by another program (is it open in Excel?). Close it and try again.');
      }
      throw err;
    }
    const st = await fs.stat(this.options.filePath);
    this.lastKnownMtimeMs = st.mtimeMs;
  }

  private async pruneBackups(): Promise<void> {
    const keep = this.options.backupRetention?.() ?? 30;
    const backups = await this.listBackups();
    await Promise.all(backups.slice(keep).map((b) => fs.rm(path.join(this.options.backupDir, b.fileName), { force: true })));
  }
}

async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (i >= attempts - 1 || !['EBUSY', 'EPERM', 'EACCES'].includes(code ?? '')) throw err;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
}
