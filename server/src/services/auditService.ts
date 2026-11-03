import type { AuditLog } from '@leaveflow/shared';
import { nowIso, type Actor, type ServiceDeps } from './context.js';

export class AuditService {
  constructor(private readonly deps: ServiceDeps) {}

  async log(actor: Actor | null, action: string, entityType: string, entityId: string, details?: unknown): Promise<void> {
    await this.deps.repos.audit.create({
      timestamp: nowIso(this.deps),
      actorId: actor?.employeeId ?? 'SYSTEM',
      action,
      entityType,
      entityId,
      details: details === undefined ? '' : JSON.stringify(details).slice(0, 2000),
    });
  }

  async list(filters: { entityType?: string; actorId?: string; limit?: number }): Promise<AuditLog[]> {
    const rows = await this.deps.repos.audit.findWhere(
      (a) => (!filters.entityType || a.entityType === filters.entityType) && (!filters.actorId || a.actorId === filters.actorId),
    );
    return rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, filters.limit ?? 200);
  }
}
