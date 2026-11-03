import type { LeaveBalance, LeaveStatus, HandoverStatus, HandoverTask, OrgSettings } from './types';

/** Total entitlement for the year (allocation + carry forward + manual adjustments/comp-offs). */
export function balanceTotal(b: Pick<LeaveBalance, 'allocated' | 'carriedForward' | 'adjusted'>): number {
  return round(b.allocated + b.carriedForward + b.adjusted);
}

/** Days still available to apply for (pending requests are already reserved). */
export function balanceAvailable(b: Pick<LeaveBalance, 'allocated' | 'carriedForward' | 'adjusted' | 'used' | 'pending'>): number {
  return round(balanceTotal(b) - b.used - b.pending);
}

/** Carry-forward into next year, capped by policy. */
export function carryForwardAmount(available: number, allowCarryForward: boolean, maxCarryForward: number): number {
  if (!allowCarryForward || available <= 0) return 0;
  return Math.min(available, maxCarryForward > 0 ? maxCarryForward : available);
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Allowed leave status transitions — enforced by the API. */
export const LEAVE_TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED'],
  CHANGES_REQUESTED: ['PENDING', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionLeave(from: LeaveStatus, to: LeaveStatus): boolean {
  return LEAVE_TRANSITIONS[from].includes(to);
}

/** Allowed handover status transitions — enforced by the API. */
export const HANDOVER_TRANSITIONS: Record<HandoverStatus, HandoverStatus[]> = {
  DRAFT: ['PENDING_ACCEPTANCE', 'CANCELLED'],
  PENDING_ACCEPTANCE: ['ACCEPTED', 'DECLINED', 'CANCELLED', 'PENDING_ACCEPTANCE'],
  ACCEPTED: ['ACTIVE', 'CANCELLED', 'PENDING_ACCEPTANCE'],
  DECLINED: ['PENDING_ACCEPTANCE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionHandover(from: HandoverStatus, to: HandoverStatus): boolean {
  return HANDOVER_TRANSITIONS[from].includes(to);
}

/**
 * The handover becomes ACTIVE once the backup has accepted it AND the leave is approved.
 * Returns the status the handover should move to given the latest leave/handover state.
 */
export function resolveHandoverStatus(handoverStatus: HandoverStatus, leaveStatus: LeaveStatus): HandoverStatus {
  if (leaveStatus === 'REJECTED' || leaveStatus === 'CANCELLED') {
    return handoverStatus === 'COMPLETED' ? handoverStatus : 'CANCELLED';
  }
  if (handoverStatus === 'ACCEPTED' && leaveStatus === 'APPROVED') return 'ACTIVE';
  return handoverStatus;
}

export function completionPercent(tasks: Pick<HandoverTask, 'taskStatus'>[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.taskStatus === 'COMPLETED').length;
  return Math.round((done / tasks.length) * 100);
}

export function isTaskOverdue(task: Pick<HandoverTask, 'dueDate' | 'taskStatus'>, today: string): boolean {
  return Boolean(task.dueDate) && task.dueDate < today && task.taskStatus !== 'COMPLETED';
}

export const DEFAULT_SETTINGS: OrgSettings = {
  organizationName: 'LeaveFlow Technologies Pvt. Ltd.',
  organizationEmail: 'hr@leaveflow.demo',
  organizationAddress: 'Outer Ring Road, Bengaluru, Karnataka 560103',
  timezone: 'Asia/Kolkata',
  workingDays: [1, 2, 3, 4, 5],
  fiscalYearStartMonth: 1,
  requireHandover: true,
  requireHandoverAcceptanceBeforeApproval: false,
  allowSelfApprovalForAdmins: false,
  teamOverlapWarningPercent: 30,
  backupOverloadThreshold: 2,
  remoteWorkEnabled: true,
  autoCompleteHandovers: true,
  notifyInApp: true,
  notifyEmail: false,
  notifyLeaveStartReminder: true,
  notifyTaskOverdue: true,
  notificationPollSeconds: 30,
  backupRetentionCount: 30,
};

export const SETTING_DESCRIPTIONS: Record<keyof OrgSettings, string> = {
  organizationName: 'Organisation display name',
  organizationEmail: 'HR contact email',
  organizationAddress: 'Registered office address',
  timezone: 'IANA timezone used to compute "today"',
  workingDays: 'Comma separated weekday numbers (0=Sun … 6=Sat)',
  fiscalYearStartMonth: 'Month (1-12) the leave year starts',
  requireHandover: 'A work handover is mandatory for every leave request',
  requireHandoverAcceptanceBeforeApproval: 'Block leave approval until the backup accepts the handover',
  allowSelfApprovalForAdmins: 'Allow HR admins to approve their own leave',
  teamOverlapWarningPercent: 'Warn approvers when this % of a team is away on the same day',
  backupOverloadThreshold: 'Open handovers after which a backup is flagged as overloaded',
  remoteWorkEnabled: 'Show remote-working status in team availability',
  autoCompleteHandovers: 'Auto-complete handovers once the employee returns',
  notifyInApp: 'Send in-app notifications',
  notifyEmail: 'Send email notifications (requires an email provider)',
  notifyLeaveStartReminder: 'Remind employees and backups the day before leave starts',
  notifyTaskOverdue: 'Notify assignees about overdue handover tasks',
  notificationPollSeconds: 'How often the UI refreshes notifications (seconds)',
  backupRetentionCount: 'Number of workbook backups to keep',
};
