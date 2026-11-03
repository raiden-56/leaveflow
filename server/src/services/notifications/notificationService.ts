import type { Notification, NotificationType } from '@leaveflow/shared';
import { forbidden, notFound } from '../../utils/errors.js';
import { nowIso, type Actor, type ServiceDeps } from '../context.js';
import type { SettingsService } from '../settingsService.js';
import type { NotificationChannel, NotificationDraft } from './channels.js';

export interface NotifyInput {
  recipientIds: (string | undefined | null)[];
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  /** Skip recipients that already received this type for this entity. */
  dedupe?: boolean;
  /** Never notify the person who caused the event. */
  excludeActorId?: string;
}

export class NotificationService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly inApp: NotificationChannel,
    private readonly extraChannels: NotificationChannel[] = [],
  ) {}

  async notify(input: NotifyInput): Promise<number> {
    const settings = await this.settings.get();
    const ids = [...new Set(input.recipientIds.filter((id): id is string => Boolean(id)))].filter(
      (id) => id !== input.excludeActorId,
    );
    let sent = 0;
    for (const recipientId of ids) {
      const recipient = await this.deps.repos.employees.findById(recipientId);
      if (!recipient || recipient.employmentStatus === 'INACTIVE') continue;
      if (input.dedupe) {
        const exists = await this.deps.repos.notifications.count(
          (n) => n.recipientId === recipientId && n.type === input.type && n.entityId === (input.entityId ?? ''),
        );
        if (exists > 0) continue;
      }
      const draft: NotificationDraft = {
        recipientId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType ?? '',
        entityId: input.entityId ?? '',
        link: input.link ?? '',
      };
      const createdAt = nowIso(this.deps);
      if (settings.notifyInApp) await this.inApp.send(draft, recipient, createdAt);
      if (settings.notifyEmail) {
        for (const channel of this.extraChannels) await channel.send(draft, recipient, createdAt);
      }
      sent++;
    }
    return sent;
  }

  async list(actor: Actor, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const items = (await this.deps.repos.notifications.findForRecipient(actor.employeeId))
      .filter((n) => !opts.unreadOnly || !n.isRead)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unread = items.filter((n) => !n.isRead).length;
    return { items: items.slice(0, opts.limit ?? 200), unread, total: items.length };
  }

  async markRead(actor: Actor, id: string): Promise<Notification> {
    const n = await this.deps.repos.notifications.findById(id);
    if (!n) throw notFound('Notification', id);
    if (n.recipientId !== actor.employeeId) throw forbidden();
    if (n.isRead) return n;
    return this.deps.repos.notifications.update(id, { isRead: true, readAt: nowIso(this.deps) });
  }

  async markAllRead(actor: Actor): Promise<number> {
    return this.deps.repos.notifications.markAllRead(actor.employeeId, nowIso(this.deps));
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const n = await this.deps.repos.notifications.findById(id);
    if (!n) throw notFound('Notification', id);
    if (n.recipientId !== actor.employeeId) throw forbidden();
    await this.deps.repos.notifications.delete(id);
  }
}
