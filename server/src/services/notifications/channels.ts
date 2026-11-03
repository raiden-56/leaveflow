import type { Employee, Notification } from '@leaveflow/shared';
import type { INotificationRepository } from '../../repositories/interfaces.js';
import { logger } from '../../utils/logger.js';

export type NotificationDraft = Omit<Notification, 'notificationId' | 'isRead' | 'readAt' | 'createdAt'>;

/**
 * A delivery channel. The in-app channel persists to the Notifications sheet;
 * email / push / websocket channels can be added later without touching the
 * services that raise notifications.
 */
export interface NotificationChannel {
  readonly name: string;
  send(draft: NotificationDraft, recipient: Employee, createdAt: string): Promise<void>;
}

export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';
  constructor(private readonly repo: INotificationRepository) {}
  async send(draft: NotificationDraft, _recipient: Employee, createdAt: string): Promise<void> {
    await this.repo.create({ ...draft, isRead: false, readAt: '', createdAt });
  }
}

/** Placeholder email channel: logs instead of sending until an SMTP/SES provider is configured. */
export class ConsoleEmailChannel implements NotificationChannel {
  readonly name = 'email';
  async send(draft: NotificationDraft, recipient: Employee): Promise<void> {
    logger.info(`[email] to=${recipient.email} subject="${draft.title}"`);
  }
}
