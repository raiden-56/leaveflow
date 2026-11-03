import { SHEETS, SHEET_NAMES, emptyTables, type SheetName, type Tables } from '@server/excel/schema';
import type { DataStore } from '@server/excel/tableStore';
import { workbookToBytes } from '@server/excel/workbookFormat';
import { Mutex } from '@server/utils/mutex';

const DATA_KEY = 'leaveflow.workbook.v1';
const BACKUP_KEY = 'leaveflow.backups.v1';
const MAX_BACKUPS = 3;

interface StoredBackup {
  fileName: string;
  createdAt: string;
  data: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
}

/**
 * DataStore for the static (GitHub Pages) build. Holds the same workbook
 * tables as the Node WorkbookStore, persisted in the browser's localStorage,
 * and exports them as a real .xlsx file on demand.
 *
 * Transactions are serialised with the same mutex; writes go to the live
 * tables and are rolled back from a snapshot if the unit of work fails.
 */
export class BrowserStore implements DataStore {
  private tables: Tables = emptyTables();
  private readonly mutex = new Mutex();
  private depth = 0;
  private lastModified = new Date().toISOString();

  /** Loads saved data, or creates it with `seed()` on first visit. */
  init(seed: () => Tables): { created: boolean } {
    const saved = readJson<{ tables: Tables; lastModified: string } | null>(DATA_KEY, null);
    if (saved?.tables && SHEET_NAMES.every((s) => Array.isArray(saved.tables[s]))) {
      this.tables = saved.tables;
      this.lastModified = saved.lastModified;
      return { created: false };
    }
    this.tables = seed();
    this.persist();
    return { created: true };
  }

  reset(seed: () => Tables): void {
    this.tables = seed();
    this.persist();
    try {
      localStorage.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
  }

  rows<T = Record<string, unknown>>(sheet: SheetName): T[] {
    return (this.tables[sheet] ?? []) as unknown as T[];
  }

  get inTransaction(): boolean {
    return this.depth > 0;
  }

  async ensureFresh(): Promise<void> {}

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.depth > 0) return fn(); // nested: join the outer unit of work
    return this.mutex.runExclusive(async () => {
      const before = JSON.stringify(this.tables);
      this.depth++;
      try {
        const result = await fn();
        if (JSON.stringify(this.tables) !== before) {
          this.backup(before);
          this.persist();
        }
        return result;
      } catch (err) {
        this.tables = JSON.parse(before) as Tables; // roll back
        throw err;
      } finally {
        this.depth--;
      }
    });
  }

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

  async info() {
    const backups = readJson<StoredBackup[]>(BACKUP_KEY, []);
    return {
      filePath: 'Browser storage (localStorage) — download to get the .xlsx',
      sizeBytes: JSON.stringify(this.tables).length,
      lastModified: this.lastModified,
      sheets: SHEET_NAMES.map((name) => ({ name, rows: this.tables[name].length })),
      backups: backups.map((b) => ({ fileName: b.fileName, sizeBytes: b.data.length, createdAt: b.createdAt })),
    };
  }

  async createBackup(label = 'manual'): Promise<string | null> {
    return this.backup(JSON.stringify(this.tables), label);
  }

  async exportWorkbook(): Promise<Uint8Array> {
    return workbookToBytes(this.tables);
  }

  async readBackup(fileName: string): Promise<Uint8Array | null> {
    const found = readJson<StoredBackup[]>(BACKUP_KEY, []).find((b) => b.fileName === fileName);
    return found ? workbookToBytes(JSON.parse(found.data) as Tables) : null;
  }

  private backup(snapshot: string, label = 'auto'): string {
    const createdAt = new Date().toISOString();
    // Same YYYYMMDD-HHmmss-SSS stamp as the server's backups (and no stray "." from the ISO milliseconds).
    const d = createdAt.replace(/\D/g, '');
    const fileName = `LeaveFlow-${d.slice(0, 8)}-${d.slice(8, 14)}-${d.slice(14, 17)}-${label}.xlsx`;
    const backups = [{ fileName, createdAt, data: snapshot }, ...readJson<StoredBackup[]>(BACKUP_KEY, [])].slice(0, MAX_BACKUPS);
    writeKey(BACKUP_KEY, JSON.stringify(backups));
    return fileName;
  }

  private persist(): void {
    this.lastModified = new Date().toISOString();
    writeKey(DATA_KEY, JSON.stringify({ tables: this.tables, lastModified: this.lastModified }));
  }
}
