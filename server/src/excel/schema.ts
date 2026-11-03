import {
  APPROVAL_ACTIONS,
  APPROVAL_ENTITY_TYPES,
  EMPLOYMENT_STATUSES,
  HALF_DAY_OPTIONS,
  HANDOVER_STATUSES,
  HOLIDAY_TYPES,
  LEAVE_STATUSES,
  NOTIFICATION_TYPES,
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
  TRANSACTION_TYPES,
  WORK_MODES,
} from '@leaveflow/shared';

/**
 * Declarative workbook schema. Each worksheet is described once here and the
 * WorkbookStore uses it to (de)serialise rows, apply Excel data validation and
 * format headers. Columns are matched by header name, so re-ordering columns
 * in Excel is safe.
 */

export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

export interface ColumnDef {
  key: string;
  type: ColumnType;
  width?: number;
  enum?: readonly string[];
  required?: boolean;
}

export interface SheetDef {
  name: SheetName;
  idField: string;
  /** Prefix for generated IDs, e.g. EMP -> EMP0001. Empty when IDs are user supplied. */
  idPrefix: string;
  idPad: number;
  columns: ColumnDef[];
}

export const SHEET_NAMES = [
  'Employees',
  'LeaveRequests',
  'LeaveBalances',
  'LeaveTypes',
  'Holidays',
  'WorkHandovers',
  'HandoverTasks',
  'Approvals',
  'Notifications',
  'Departments',
  'Settings',
  'LeaveTransactions',
  'AuditLog',
] as const;
export type SheetName = (typeof SHEET_NAMES)[number];

const s = (key: string, width = 18, extra: Partial<ColumnDef> = {}): ColumnDef => ({ key, type: 'string', width, ...extra });
const n = (key: string, width = 12): ColumnDef => ({ key, type: 'number', width });
const b = (key: string, width = 12): ColumnDef => ({ key, type: 'boolean', width });
const d = (key: string, width = 14): ColumnDef => ({ key, type: 'date', width });
const dt = (key: string, width = 24): ColumnDef => ({ key, type: 'datetime', width });
const e = (key: string, values: readonly string[], width = 20): ColumnDef => ({ key, type: 'string', width, enum: values });

export const SHEETS: Record<SheetName, SheetDef> = {
  Employees: {
    name: 'Employees',
    idField: 'employeeId',
    idPrefix: 'EMP',
    idPad: 3,
    columns: [
      s('employeeId', 12, { required: true }),
      s('employeeName', 24, { required: true }),
      s('email', 32, { required: true }),
      s('phone', 16),
      s('department', 22),
      s('designation', 28),
      s('managerId', 12),
      d('joiningDate'),
      e('employmentStatus', EMPLOYMENT_STATUSES, 16),
      e('role', ROLES, 12),
      s('profileImage', 20),
      e('workMode', WORK_MODES, 12),
      s('location', 14),
    ],
  },
  LeaveRequests: {
    name: 'LeaveRequests',
    idField: 'leaveId',
    idPrefix: 'LV',
    idPad: 4,
    columns: [
      s('leaveId', 10, { required: true }),
      s('employeeId', 12, { required: true }),
      s('leaveType', 10),
      d('startDate'),
      d('endDate'),
      n('totalDays', 10),
      e('halfDay', HALF_DAY_OPTIONS, 14),
      s('reason', 40),
      d('appliedDate'),
      e('status', LEAVE_STATUSES, 20),
      s('approverId', 12),
      d('approvalDate'),
      s('rejectionReason', 32),
      s('managerComment', 32),
      s('emergencyContact', 22),
      s('contactDuringLeave', 22),
      s('attachmentName', 22),
      s('attachmentUrl', 28),
      dt('updatedAt'),
    ],
  },
  LeaveBalances: {
    name: 'LeaveBalances',
    idField: 'balanceId',
    idPrefix: 'BAL',
    idPad: 4,
    columns: [
      s('balanceId', 10, { required: true }),
      s('employeeId', 12, { required: true }),
      n('year', 8),
      s('leaveType', 10),
      n('allocated'),
      n('carriedForward', 14),
      n('adjusted'),
      n('used'),
      n('pending'),
    ],
  },
  LeaveTypes: {
    name: 'LeaveTypes',
    idField: 'code',
    idPrefix: '',
    idPad: 0,
    columns: [
      s('code', 8, { required: true }),
      s('name', 22),
      s('description', 40),
      n('annualAllocation', 16),
      b('isPaid', 8),
      b('trackBalance', 12),
      b('allowHalfDay', 12),
      b('allowCarryForward', 16),
      n('maxCarryForward', 16),
      n('maxConsecutiveDays', 18),
      n('minNoticeDays', 14),
      n('backdatedDays', 14),
      b('requiresApproval', 16),
      n('requiresAttachmentAfterDays', 24),
      b('excludeWeekendsAndHolidays', 24),
      s('color', 10),
      b('isActive', 10),
      b('includeInTotals', 16),
    ],
  },
  Holidays: {
    name: 'Holidays',
    idField: 'holidayId',
    idPrefix: 'HOL',
    idPad: 3,
    columns: [
      s('holidayId', 10, { required: true }),
      s('holidayName', 28),
      d('holidayDate'),
      e('holidayType', HOLIDAY_TYPES, 14),
      s('description', 40),
    ],
  },
  WorkHandovers: {
    name: 'WorkHandovers',
    idField: 'handoverId',
    idPrefix: 'HO',
    idPad: 4,
    columns: [
      s('handoverId', 10, { required: true }),
      s('leaveId', 10),
      s('employeeId', 12),
      s('backupEmployeeId', 16),
      s('handoverTitle', 32),
      s('handoverDescription', 48),
      d('startDate'),
      d('endDate'),
      e('priority', PRIORITIES, 10),
      s('instructions', 40),
      e('handoverStatus', HANDOVER_STATUSES, 20),
      dt('acceptedDate'),
      s('declineReason', 30),
      n('completionStatus', 16),
      dt('createdAt'),
      dt('completedDate'),
    ],
  },
  HandoverTasks: {
    name: 'HandoverTasks',
    idField: 'taskId',
    idPrefix: 'TSK',
    idPad: 4,
    columns: [
      s('taskId', 10, { required: true }),
      s('handoverId', 10),
      s('taskTitle', 32),
      s('taskDescription', 44),
      e('priority', PRIORITIES, 10),
      d('dueDate'),
      s('assignedEmployeeId', 18),
      e('taskStatus', TASK_STATUSES, 14),
      s('comments', 32),
      s('referenceLinks', 32),
      s('expectedOutcome', 32),
      s('notes', 28),
      dt('createdAt'),
      dt('updatedAt'),
    ],
  },
  Approvals: {
    name: 'Approvals',
    idField: 'approvalId',
    idPrefix: 'APR',
    idPad: 5,
    columns: [
      s('approvalId', 11, { required: true }),
      e('entityType', APPROVAL_ENTITY_TYPES, 12),
      s('entityId', 10),
      e('action', APPROVAL_ACTIONS, 20),
      s('actorId', 10),
      s('comment', 40),
      dt('createdAt'),
    ],
  },
  Notifications: {
    name: 'Notifications',
    idField: 'notificationId',
    idPrefix: 'NTF',
    idPad: 5,
    columns: [
      s('notificationId', 12, { required: true }),
      s('recipientId', 12),
      e('type', NOTIFICATION_TYPES, 24),
      s('title', 30),
      s('message', 60),
      s('entityType', 12),
      s('entityId', 10),
      s('link', 24),
      b('isRead', 8),
      dt('createdAt'),
      dt('readAt'),
    ],
  },
  Departments: {
    name: 'Departments',
    idField: 'departmentId',
    idPrefix: 'DEP',
    idPad: 2,
    columns: [
      s('departmentId', 12, { required: true }),
      s('departmentName', 24),
      s('headId', 10),
      s('description', 40),
      s('color', 10),
    ],
  },
  Settings: {
    name: 'Settings',
    idField: 'key',
    idPrefix: '',
    idPad: 0,
    columns: [s('key', 36, { required: true }), s('value', 40), s('description', 60)],
  },
  LeaveTransactions: {
    name: 'LeaveTransactions',
    idField: 'transactionId',
    idPrefix: 'TXN',
    idPad: 5,
    columns: [
      s('transactionId', 12, { required: true }),
      s('employeeId', 12),
      s('leaveType', 10),
      n('year', 8),
      e('transactionType', TRANSACTION_TYPES, 16),
      n('days', 8),
      s('leaveId', 10),
      s('reason', 40),
      s('performedBy', 12),
      dt('createdAt'),
    ],
  },
  AuditLog: {
    name: 'AuditLog',
    idField: 'auditId',
    idPrefix: 'AUD',
    idPad: 6,
    columns: [
      s('auditId', 12, { required: true }),
      dt('timestamp'),
      s('actorId', 10),
      s('action', 28),
      s('entityType', 16),
      s('entityId', 12),
      s('details', 60),
    ],
  },
};

export type Row = Record<string, string | number | boolean>;
export type Tables = Record<SheetName, Row[]>;

export function emptyTables(): Tables {
  return Object.fromEntries(SHEET_NAMES.map((name) => [name, []])) as unknown as Tables;
}

/** Default value for a column when a cell is empty. */
export function defaultFor(col: ColumnDef): string | number | boolean {
  if (col.type === 'number') return 0;
  if (col.type === 'boolean') return false;
  return '';
}
