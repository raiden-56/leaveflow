/**
 * Domain model shared by the LeaveFlow server and client.
 * Every persisted entity maps 1:1 to a worksheet row (Excel) or a table row (future PostgreSQL).
 * Dates are calendar dates in ISO format (YYYY-MM-DD); timestamps are ISO-8601 strings.
 */

export const ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_NOTICE', 'INACTIVE'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const WORK_MODES = ['OFFICE', 'REMOTE', 'HYBRID'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Leave statuses that block the dates for the employee (used for overlap checks). */
export const ACTIVE_LEAVE_STATUSES: readonly LeaveStatus[] = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED'];

export const HALF_DAY_OPTIONS = ['NONE', 'FIRST_HALF', 'SECOND_HALF'] as const;
export type HalfDay = (typeof HALF_DAY_OPTIONS)[number];

export const HANDOVER_STATUSES = [
  'DRAFT',
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'DECLINED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

/** Handover statuses that count towards a backup employee's workload. */
export const OPEN_HANDOVER_STATUSES: readonly HandoverStatus[] = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE'];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const HOLIDAY_TYPES = ['PUBLIC', 'OPTIONAL', 'COMPANY'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'LEAVE_SUBMITTED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'LEAVE_CHANGES_REQUESTED',
  'LEAVE_CANCELLED',
  'HANDOVER_ASSIGNED',
  'HANDOVER_ACCEPTED',
  'HANDOVER_DECLINED',
  'HANDOVER_COMPLETED',
  'TASK_OVERDUE',
  'LEAVE_STARTS_TOMORROW',
  'EMPLOYEE_RETURNED',
  'BALANCE_ADJUSTED',
  'GENERAL',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const APPROVAL_ENTITY_TYPES = ['LEAVE', 'HANDOVER'] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

export const APPROVAL_ACTIONS = [
  'SUBMITTED',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'CANCELLED',
  'ACCEPTED',
  'DECLINED',
  'ACTIVATED',
  'COMPLETED',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const TRANSACTION_TYPES = [
  'ALLOCATION',
  'CARRY_FORWARD',
  'APPLIED',
  'APPROVED',
  'RELEASED',
  'REVERSED',
  'ADJUSTMENT',
  'COMP_OFF',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ---------------------------------------------------------------------------
// Entities (one per worksheet)
// ---------------------------------------------------------------------------

export interface Employee {
  employeeId: string;
  employeeName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  managerId: string;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  role: Role;
  profileImage: string;
  workMode: WorkMode;
  location: string;
}

export interface Department {
  departmentId: string;
  departmentName: string;
  headId: string;
  description: string;
  color: string;
}

export interface LeaveType {
  code: string;
  name: string;
  description: string;
  annualAllocation: number;
  isPaid: boolean;
  /** When false the balance is not tracked (e.g. unpaid leave). */
  trackBalance: boolean;
  allowHalfDay: boolean;
  allowCarryForward: boolean;
  maxCarryForward: number;
  /** 0 = no limit. */
  maxConsecutiveDays: number;
  minNoticeDays: number;
  /** How many days in the past an application may start (0 = no backdating). */
  backdatedDays: number;
  requiresApproval: boolean;
  /** Attachment becomes mandatory above this many days (0 = never). */
  requiresAttachmentAfterDays: number;
  /** When false, calendar days are counted (e.g. maternity leave). */
  excludeWeekendsAndHolidays: boolean;
  color: string;
  isActive: boolean;
  /** Counted in the dashboard "total balance" (false for event-based leave such as maternity). */
  includeInTotals: boolean;
}

export interface LeaveRequest {
  leaveId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay: HalfDay;
  reason: string;
  appliedDate: string;
  status: LeaveStatus;
  approverId: string;
  approvalDate: string;
  rejectionReason: string;
  managerComment: string;
  emergencyContact: string;
  contactDuringLeave: string;
  attachmentName: string;
  attachmentUrl: string;
  updatedAt: string;
}

export interface LeaveBalance {
  balanceId: string;
  employeeId: string;
  year: number;
  leaveType: string;
  allocated: number;
  carriedForward: number;
  adjusted: number;
  used: number;
  pending: number;
}

export interface LeaveTransaction {
  transactionId: string;
  employeeId: string;
  leaveType: string;
  year: number;
  transactionType: TransactionType;
  days: number;
  leaveId: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface Holiday {
  holidayId: string;
  holidayName: string;
  holidayDate: string;
  holidayType: HolidayType;
  description: string;
}

export interface WorkHandover {
  handoverId: string;
  leaveId: string;
  employeeId: string;
  backupEmployeeId: string;
  handoverTitle: string;
  handoverDescription: string;
  startDate: string;
  endDate: string;
  priority: Priority;
  instructions: string;
  handoverStatus: HandoverStatus;
  acceptedDate: string;
  declineReason: string;
  /** Percentage (0-100) of tasks completed. */
  completionStatus: number;
  createdAt: string;
  completedDate: string;
}

export interface HandoverTask {
  taskId: string;
  handoverId: string;
  taskTitle: string;
  taskDescription: string;
  priority: Priority;
  dueDate: string;
  assignedEmployeeId: string;
  taskStatus: TaskStatus;
  comments: string;
  referenceLinks: string;
  expectedOutcome: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  approvalId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  action: ApprovalAction;
  actorId: string;
  comment: string;
  createdAt: string;
}

export interface Notification {
  notificationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  readAt: string;
}

export interface SettingRow {
  key: string;
  value: string;
  description: string;
}

export interface AuditLog {
  auditId: string;
  timestamp: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

/** Typed view over the Settings key/value sheet. */
export interface OrgSettings {
  organizationName: string;
  organizationEmail: string;
  organizationAddress: string;
  timezone: string;
  /** ISO weekday numbers that are working days (0 = Sunday ... 6 = Saturday). */
  workingDays: number[];
  fiscalYearStartMonth: number;
  requireHandover: boolean;
  requireHandoverAcceptanceBeforeApproval: boolean;
  allowSelfApprovalForAdmins: boolean;
  /** Warn the approver when more than this % of the team is away on the same day. */
  teamOverlapWarningPercent: number;
  /** A backup holding more than this many open handovers is flagged as overloaded. */
  backupOverloadThreshold: number;
  remoteWorkEnabled: boolean;
  autoCompleteHandovers: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyLeaveStartReminder: boolean;
  notifyTaskOverdue: boolean;
  notificationPollSeconds: number;
  backupRetentionCount: number;
}

// ---------------------------------------------------------------------------
// API views (enriched read models)
// ---------------------------------------------------------------------------

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  email: string;
  department: string;
  designation: string;
  profileImage: string;
  role: Role;
}

export interface AuthUser extends Employee {
  managerName: string;
}

export interface LeaveBalanceView extends LeaveBalance {
  leaveTypeName: string;
  color: string;
  trackBalance: boolean;
  includeInTotals: boolean;
  total: number;
  available: number;
}

export interface HandoverTaskView extends HandoverTask {
  assignee?: EmployeeSummary;
  isOverdue: boolean;
}

export interface WorkHandoverView extends WorkHandover {
  employee?: EmployeeSummary;
  backupEmployee?: EmployeeSummary;
  tasks: HandoverTaskView[];
  leaveStatus?: LeaveStatus;
  leaveType?: string;
}

export interface LeaveRequestView extends LeaveRequest {
  employee?: EmployeeSummary;
  approver?: EmployeeSummary;
  leaveTypeName: string;
  leaveTypeColor: string;
  handover?: WorkHandoverView;
}

export interface ApprovalView extends Approval {
  actor?: EmployeeSummary;
}

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface InsightWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface LeaveInsights {
  warnings: InsightWarning[];
  overlappingTeamLeaves: LeaveRequestView[];
  balance?: LeaveBalanceView;
}

export interface LeaveDetails extends LeaveRequestView {
  history: ApprovalView[];
  insights: LeaveInsights;
}

export interface DayBreakdown {
  date: string;
  counted: number;
  reason?: 'WEEKEND' | 'HOLIDAY';
  holidayName?: string;
}

export interface LeavePreview {
  totalDays: number;
  days: DayBreakdown[];
  balance?: LeaveBalanceView;
  errors: string[];
  warnings: string[];
}

export interface BackupCandidate extends EmployeeSummary {
  availability: 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'ON_LEAVE';
  availabilityNote: string;
  openHandovers: number;
  openTasks: number;
  overlappingHandovers: number;
  isOverloaded: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CalendarLeaveEvent {
  leaveId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: string;
  leaveTypeName: string;
  color: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay: HalfDay;
  status: LeaveStatus;
}

export interface TeamMemberAvailability extends EmployeeSummary {
  status: 'AVAILABLE' | 'ON_LEAVE' | 'REMOTE';
  workMode: WorkMode;
  leave?: CalendarLeaveEvent;
  nextLeave?: CalendarLeaveEvent;
  openHandoversAsBackup: number;
  openTasks: number;
  isOverloaded: boolean;
}

export interface TeamAvailability {
  date: string;
  members: TeamMemberAvailability[];
  available: TeamMemberAvailability[];
  onLeave: TeamMemberAvailability[];
  remote: TeamMemberAvailability[];
  upcoming: CalendarLeaveEvent[];
}

export interface HandoverStats {
  createdActive: number;
  assignedActive: number;
  pendingAcceptance: number;
  accepted: number;
  completed: number;
  tasksAssignedToBackups: number;
  overdueTasks: number;
}

export interface EmployeeDashboard {
  balances: LeaveBalanceView[];
  totals: { available: number; used: number; pending: number; allocated: number; pendingRequests: number };
  upcomingLeaves: LeaveRequestView[];
  recentLeaves: LeaveRequestView[];
  handoverStats: HandoverStats;
  assignedHandovers: WorkHandoverView[];
  nextHoliday?: Holiday;
}

export interface ManagerDashboard {
  cards: {
    teamMembers: number;
    onLeaveToday: number;
    pendingApprovals: number;
    upcomingLeaves: number;
    pendingHandoverAcceptance: number;
    activeHandovers: number;
  };
  pendingApprovals: LeaveRequestView[];
  upcomingLeaves: LeaveRequestView[];
  workload: TeamMemberAvailability[];
  leaveTrend: { month: string; days: number }[];
}

export interface AdminDashboard {
  cards: {
    totalEmployees: number;
    totalLeavesTaken: number;
    pendingApprovals: number;
    approvedLeaves: number;
    rejectedLeaves: number;
    onLeaveToday: number;
    handoverCompletionRate: number;
  };
  departmentDistribution: { department: string; days: number; employees: number; color: string }[];
  monthlyTrend: { month: string; approved: number; pending: number; rejected: number }[];
  typeDistribution: { leaveType: string; name: string; days: number; color: string }[];
  recentRequests: LeaveRequestView[];
  onLeaveToday: CalendarLeaveEvent[];
}

export interface ReportFilters {
  from?: string;
  to?: string;
  department?: string;
  employeeId?: string;
  leaveType?: string;
}

export interface LeaveSummaryReport {
  from: string;
  to: string;
  totals: { requests: number; days: number; approved: number; pending: number; rejected: number; cancelled: number };
  byMonth: { month: string; approved: number; pending: number; rejected: number; days: number }[];
  byType: { leaveType: string; name: string; color: string; days: number; requests: number }[];
  byEmployee: { employeeId: string; employeeName: string; department: string; days: number; requests: number }[];
  pending: LeaveRequestView[];
}

export interface DepartmentSummaryReport {
  departments: {
    department: string;
    color: string;
    employees: number;
    requests: number;
    days: number;
    averageDaysPerEmployee: number;
    onLeaveToday: number;
  }[];
}

export interface HandoverSummaryReport {
  totals: Record<HandoverStatus, number>;
  completionRate: number;
  taskTotals: Record<TaskStatus, number>;
  overdueTasks: number;
  byBackup: { employeeId: string; employeeName: string; handovers: number; tasks: number; completedTasks: number }[];
  byMonth: { month: string; created: number; completed: number }[];
}

export interface WorkbookInfo {
  filePath: string;
  sizeBytes: number;
  lastModified: string;
  sheets: { name: string; rows: number }[];
  backups: { fileName: string; sizeBytes: number; createdAt: string }[];
  provider: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
