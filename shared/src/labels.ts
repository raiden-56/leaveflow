import type { HandoverStatus, LeaveStatus, Priority, Role, TaskStatus, HalfDay, HolidayType } from './types';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes requested',
  CANCELLED: 'Cancelled',
};

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  DRAFT: 'Draft',
  PENDING_ACCEPTANCE: 'Pending acceptance',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  ADMIN: 'HR Admin',
};

export const HALF_DAY_LABELS: Record<HalfDay, string> = {
  NONE: 'Full day',
  FIRST_HALF: 'First half',
  SECOND_HALF: 'Second half',
};

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  PUBLIC: 'Public holiday',
  OPTIONAL: 'Optional holiday',
  COMPANY: 'Company holiday',
};
