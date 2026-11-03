import { addDays, isTaskOverdue } from '@leaveflow/shared';
import { logger } from '../utils/logger.js';
import { loadDirectory, today, type ServiceDeps } from './context.js';
import type { HandoverService } from './handoverService.js';
import type { NotificationService } from './notifications/notificationService.js';
import type { SettingsService } from './settingsService.js';

/**
 * Time-based workflow steps (would be a cron job / queue worker in production):
 *  - remind employee + backup the day before leave starts
 *  - auto-complete handovers when the employee is back and notify "employee returned"
 *  - notify assignees about overdue handover tasks
 * Every notification is de-duplicated, so the job is safe to run repeatedly.
 */
export class LifecycleService {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly handovers: HandoverService,
    private readonly notifications: NotificationService,
  ) {}

  start(intervalMs = 30 * 60 * 1000): void {
    void this.runSafely();
    this.timer = setInterval(() => void this.runSafely(), intervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runSafely() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.run();
      if (result.reminders + result.completed + result.overdue > 0) logger.info('Lifecycle job', result);
    } catch (err) {
      logger.error('Lifecycle job failed', err);
    } finally {
      this.running = false;
    }
  }

  async run(): Promise<{ reminders: number; completed: number; overdue: number }> {
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const tomorrow = addDays(todayStr, 1);
    let reminders = 0;
    let completed = 0;
    let overdue = 0;

    await this.deps.uow.run(async () => {
      const dir = await loadDirectory(this.deps);
      const leaves = await this.deps.repos.leaves.findAll();

      if (settings.notifyLeaveStartReminder) {
        for (const leave of leaves.filter((l) => l.status === 'APPROVED' && l.startDate === tomorrow)) {
          const h = await this.deps.repos.handovers.findByLeave(leave.leaveId);
          reminders += await this.notifications.notify({
            recipientIds: [leave.employeeId, h?.backupEmployeeId],
            type: 'LEAVE_STARTS_TOMORROW',
            title: 'Leave starts tomorrow',
            message: `${dir.name(leave.employeeId)}'s leave (${leave.startDate} → ${leave.endDate}) starts tomorrow.${h ? ` ${dir.name(h.backupEmployeeId)} is covering "${h.handoverTitle}".` : ''}`,
            entityType: 'Leave',
            entityId: leave.leaveId,
            link: h ? `/handovers?id=${h.handoverId}` : `/my-leaves?leave=${leave.leaveId}`,
            dedupe: true,
          });
        }
      }

      if (settings.autoCompleteHandovers) {
        const active = await this.deps.repos.handovers.findWhere((h) => h.handoverStatus === 'ACTIVE');
        for (const h of active) {
          const leave = leaves.find((l) => l.leaveId === h.leaveId);
          if (!leave || leave.endDate >= todayStr) continue;
          await this.handovers.markCompleted(h, null);
          const employee = dir.get(h.employeeId);
          await this.notifications.notify({
            recipientIds: [h.backupEmployeeId, employee?.managerId],
            type: 'EMPLOYEE_RETURNED',
            title: 'Employee returned from leave',
            message: `${employee?.employeeName ?? h.employeeId} is back from leave. Responsibilities for "${h.handoverTitle}" are handed back.`,
            entityType: 'Handover',
            entityId: h.handoverId,
            link: `/handovers?id=${h.handoverId}`,
            dedupe: true,
          });
          completed++;
        }
      }

      if (settings.notifyTaskOverdue) {
        const open = await this.deps.repos.handovers.findWhere((h) => ['ACCEPTED', 'ACTIVE'].includes(h.handoverStatus));
        const tasks = await this.deps.repos.tasks.findByHandovers(open.map((h) => h.handoverId));
        for (const t of tasks.filter((task) => isTaskOverdue(task, todayStr))) {
          const h = open.find((x) => x.handoverId === t.handoverId)!;
          overdue += await this.notifications.notify({
            recipientIds: [t.assignedEmployeeId],
            type: 'TASK_OVERDUE',
            title: 'Handover task overdue',
            message: `"${t.taskTitle}" (${h.handoverTitle}) was due on ${t.dueDate}.`,
            entityType: 'Task',
            entityId: t.taskId,
            link: `/handovers?id=${h.handoverId}`,
            dedupe: true,
          });
        }
      }
    });
    return { reminders, completed, overdue };
  }
}
