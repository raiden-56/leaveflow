/**
 * Minimal FIFO async mutex. All workbook writes are serialised through one
 * instance so concurrent HTTP requests can never interleave file writes.
 */
export class Mutex {
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;

  get isLocked(): boolean {
    return this.pending > 0;
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    this.pending++;
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => (release = resolve));
    try {
      await previous;
      return await fn();
    } finally {
      this.pending--;
      release();
    }
  }
}
