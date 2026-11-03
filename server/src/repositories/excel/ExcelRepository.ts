import type { TableStore } from '../../excel/tableStore.js';
import { SHEETS, type SheetName } from '../../excel/schema.js';
import { coerceRow } from '../../excel/coerce.js';
import { conflict, notFound } from '../../utils/errors.js';
import type { IRepository, IUnitOfWork } from '../interfaces.js';

/**
 * Generic worksheet-backed repository. Every concrete Excel repository extends
 * this class and only adds query helpers. Writes automatically join the current
 * unit of work, or open their own transaction when called standalone.
 */
export class ExcelRepository<T extends object, K extends keyof T & string> implements IRepository<T, K> {
  protected readonly idField: K;

  constructor(
    protected readonly store: TableStore,
    protected readonly sheet: SheetName,
  ) {
    this.idField = SHEETS[sheet].idField as K;
  }

  /** Current rows (committed snapshot or transaction working copy). */
  protected rows(): T[] {
    return this.store.rows<T>(this.sheet);
  }

  protected async read(): Promise<T[]> {
    await this.store.ensureFresh();
    return this.rows();
  }

  async findAll(): Promise<T[]> {
    return (await this.read()).map((r) => ({ ...r }));
  }

  async findById(id: T[K] & string): Promise<T | null> {
    const row = (await this.read()).find((r) => r[this.idField] === id);
    return row ? { ...row } : null;
  }

  async findWhere(predicate: (item: T) => boolean): Promise<T[]> {
    return (await this.read()).filter(predicate).map((r) => ({ ...r }));
  }

  async count(predicate?: (item: T) => boolean): Promise<number> {
    const rows = await this.read();
    return predicate ? rows.filter(predicate).length : rows.length;
  }

  async create(data: Omit<T, K> & Partial<Pick<T, K>>): Promise<T> {
    return this.store.transaction(async () => this.insert(data));
  }

  async createMany(data: (Omit<T, K> & Partial<Pick<T, K>>)[]): Promise<T[]> {
    return this.store.transaction(async () => data.map((d) => this.insert(d)));
  }

  async update(id: T[K] & string, patch: Partial<T>): Promise<T> {
    return this.store.transaction(async () => {
      const rows = this.rows();
      const index = rows.findIndex((r) => r[this.idField] === id);
      if (index < 0) throw notFound(this.sheet, id);
      const { [this.idField]: _ignored, ...rest } = patch as Record<string, unknown>;
      const updated = coerceRow(this.sheet, { ...rows[index], ...rest }) as T;
      rows[index] = updated;
      return { ...updated };
    });
  }

  async delete(id: T[K] & string): Promise<void> {
    await this.store.transaction(async () => {
      const rows = this.rows();
      const index = rows.findIndex((r) => r[this.idField] === id);
      if (index < 0) throw notFound(this.sheet, id);
      rows.splice(index, 1);
    });
  }

  protected insert(data: Omit<T, K> & Partial<Pick<T, K>>): T {
    const rows = this.rows();
    const record = { ...data } as Record<string, unknown>;
    if (!record[this.idField]) record[this.idField] = this.store.nextId(this.sheet);
    if (rows.some((r) => r[this.idField] === record[this.idField])) {
      throw conflict(`${this.sheet}: ${String(record[this.idField])} already exists`);
    }
    const row = coerceRow(this.sheet, record) as T;
    rows.push(row);
    return { ...row };
  }
}

export class ExcelUnitOfWork implements IUnitOfWork {
  constructor(private readonly store: TableStore) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.store.transaction(work);
  }
}
