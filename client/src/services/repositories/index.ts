import type {
  AdminDashboard,
  AuditLog,
  AuthUser,
  BackupCandidate,
  BalanceAdjustmentInput,
  CalendarLeaveEvent,
  CompOffInput,
  Department,
  DepartmentInput,
  DepartmentSummaryReport,
  Employee,
  EmployeeDashboard,
  EmployeeInput,
  HandoverInput,
  HandoverSummaryReport,
  HandoverTaskInput,
  HandoverTaskView,
  Holiday,
  HolidayInput,
  LeaveApplicationInput,
  LeaveBalanceView,
  LeaveDetails,
  LeavePreview,
  LeavePreviewInput,
  LeaveRequestView,
  LeaveSummaryReport,
  LeaveTransaction,
  LeaveType,
  LeaveTypeInput,
  ManagerDashboard,
  Notification,
  OrgSettings,
  ReportFilters,
  Role,
  SettingsInput,
  TaskUpdateInput,
  TeamAvailability,
  WorkHandover,
  WorkHandoverView,
  WorkbookInfo,
} from '@leaveflow/shared';
import { downloadFile, request } from '../api/httpClient';

/**
 * Frontend data-access layer. UI code never calls axios directly; it goes
 * through these repositories (wrapped by RTK Query in app/store/api.ts). Only
 * this folder knows URLs, so the backend can change without touching the UI.
 */

export type LeaveScope = 'mine' | 'team' | 'all' | 'approvals';
export interface LeaveQuery {
  scope?: LeaveScope;
  status?: string;
  leaveType?: string;
  department?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  search?: string;
}
export interface HandoverQuery {
  scope?: 'created' | 'assigned' | 'team' | 'all';
  status?: string;
  priority?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}
export interface TaskQuery {
  scope?: 'mine' | 'team' | 'all';
  status?: string;
  priority?: string;
  assigneeId?: string;
  overdue?: boolean;
}
export type TaskListItem = HandoverTaskView & {
  handover: Pick<WorkHandover, 'handoverId' | 'handoverTitle' | 'handoverStatus' | 'employeeId' | 'backupEmployeeId'> & { employeeName: string };
};
export type EmployeeView = Employee & { managerName: string };
export type DepartmentView = Department & { employeeCount: number; headName: string };
export type BalanceRow = LeaveBalanceView & { employeeName: string; department: string };
export interface DemoAccounts {
  enabled: boolean;
  passwordHint: string;
  accounts: { role: Role; email: string; name: string; designation: string }[];
}
export interface NotificationList {
  items: Notification[];
  unread: number;
  total: number;
}
export interface ImportResult {
  created: number;
  updated?: number;
  skipped?: number;
  errors: string[];
}

const clean = <T extends object>(q?: T) =>
  q ? Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== null)) : undefined;

export const authRepository = {
  login: (email: string, password: string) => request<{ user: AuthUser }>({ method: 'POST', url: '/auth/login', data: { email, password } }),
  logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
  me: () => request<{ user: AuthUser; settings: OrgSettings }>({ url: '/auth/me' }),
  demoAccounts: () => request<DemoAccounts>({ url: '/auth/demo-accounts' }),
};

export const dashboardRepository = {
  employee: () => request<EmployeeDashboard>({ url: '/dashboard/employee' }),
  manager: () => request<ManagerDashboard>({ url: '/dashboard/manager' }),
  admin: () => request<AdminDashboard>({ url: '/dashboard/admin' }),
  teamAvailability: (params?: { date?: string; department?: string }) => request<TeamAvailability>({ url: '/team/availability', params: clean(params) }),
};

export const leaveRepository = {
  list: (q?: LeaveQuery) => request<LeaveRequestView[]>({ url: '/leaves', params: clean(q) }),
  get: (id: string) => request<LeaveDetails>({ url: `/leaves/${id}` }),
  preview: (input: LeavePreviewInput) => request<LeavePreview>({ method: 'POST', url: '/leaves/preview', data: input }),
  apply: (input: LeaveApplicationInput) => request<LeaveDetails>({ method: 'POST', url: '/leaves', data: input }),
  update: (id: string, input: LeaveApplicationInput) => request<LeaveDetails>({ method: 'PUT', url: `/leaves/${id}`, data: input }),
  cancel: (id: string, reason?: string) => request<LeaveDetails>({ method: 'POST', url: `/leaves/${id}/cancel`, data: { reason } }),
  approve: (id: string, comment?: string) => request<LeaveDetails>({ method: 'POST', url: `/leaves/${id}/approve`, data: { comment } }),
  reject: (id: string, comment: string) => request<LeaveDetails>({ method: 'POST', url: `/leaves/${id}/reject`, data: { comment } }),
  requestChanges: (id: string, comment: string) => request<LeaveDetails>({ method: 'POST', url: `/leaves/${id}/request-changes`, data: { comment } }),
  calendar: (q: { from: string; to: string; department?: string; leaveType?: string; employeeId?: string; includePending?: boolean }) =>
    request<{ events: CalendarLeaveEvent[]; holidays: Holiday[] }>({ url: '/leaves/calendar', params: clean(q) }),
  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ attachmentName: string; attachmentUrl: string }>({ method: 'POST', url: '/leaves/attachments', data: form });
  },
  exportExcel: (q?: LeaveQuery) => downloadFile('/leaves/export', clean(q), 'leave-history.xlsx'),
};

export const balanceRepository = {
  forEmployee: (employeeId: string, year?: number) => request<LeaveBalanceView[]>({ url: `/leave-balances/${employeeId}`, params: clean({ year }) }),
  all: (year?: number) => request<BalanceRow[]>({ url: '/leave-balances', params: clean({ year }) }),
  adjust: (employeeId: string, input: BalanceAdjustmentInput) => request<LeaveBalanceView>({ method: 'PUT', url: `/leave-balances/${employeeId}`, data: input }),
  compOff: (employeeId: string, input: CompOffInput) => request<LeaveBalanceView>({ method: 'POST', url: `/leave-balances/${employeeId}/comp-off`, data: input }),
  transactions: (employeeId: string, year?: number) => request<LeaveTransaction[]>({ url: `/leave-balances/${employeeId}/transactions`, params: clean({ year }) }),
  yearEnd: (year: number) => request<{ employees: number; carriedForward: number }>({ method: 'POST', url: '/leave-balances/year-end', data: { year } }),
  exportExcel: (year?: number) => downloadFile('/leave-balances/export', clean({ year }), 'leave-balances.xlsx'),
};

export const handoverRepository = {
  list: (q?: HandoverQuery) => request<WorkHandoverView[]>({ url: '/handovers', params: clean(q) }),
  get: (id: string) => request<WorkHandoverView>({ url: `/handovers/${id}` }),
  candidates: (startDate: string, endDate: string, excludeLeaveId?: string) =>
    request<BackupCandidate[]>({ url: '/handovers/candidates', params: clean({ startDate, endDate, excludeLeaveId }) }),
  create: (leaveId: string, input: HandoverInput) => request<WorkHandoverView>({ method: 'POST', url: '/handovers', data: { ...input, leaveId } }),
  update: (id: string, input: HandoverInput) => request<WorkHandoverView>({ method: 'PUT', url: `/handovers/${id}`, data: input }),
  accept: (id: string, comment?: string) => request<WorkHandoverView>({ method: 'POST', url: `/handovers/${id}/accept`, data: { comment } }),
  decline: (id: string, comment: string) => request<WorkHandoverView>({ method: 'POST', url: `/handovers/${id}/decline`, data: { comment } }),
  complete: (id: string, comment?: string) => request<WorkHandoverView>({ method: 'POST', url: `/handovers/${id}/complete`, data: { comment } }),
  tasks: (q?: TaskQuery) => request<TaskListItem[]>({ url: '/handovers/tasks', params: clean(q) }),
  addTask: (handoverId: string, input: HandoverTaskInput) => request<HandoverTaskView>({ method: 'POST', url: `/handovers/${handoverId}/tasks`, data: input }),
  updateTask: (taskId: string, input: TaskUpdateInput) => request<HandoverTaskView>({ method: 'PUT', url: `/handovers/tasks/${taskId}`, data: input }),
  deleteTask: (taskId: string) => request<void>({ method: 'DELETE', url: `/handovers/tasks/${taskId}` }),
};

export const employeeRepository = {
  list: (q?: { search?: string; department?: string; role?: string; status?: string; includeInactive?: boolean }) => request<EmployeeView[]>({ url: '/employees', params: clean(q) }),
  get: (id: string) => request<EmployeeView>({ url: `/employees/${id}` }),
  create: (input: EmployeeInput) => request<Employee>({ method: 'POST', url: '/employees', data: input }),
  update: (id: string, input: EmployeeInput) => request<Employee>({ method: 'PUT', url: `/employees/${id}`, data: input }),
  deactivate: (id: string) => request<Employee>({ method: 'DELETE', url: `/employees/${id}` }),
  exportExcel: () => downloadFile('/employees/export', undefined, 'employees.xlsx'),
  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ImportResult>({ method: 'POST', url: '/employees/import', data: form });
  },
};

export const masterDataRepository = {
  leaveTypes: () => request<LeaveType[]>({ url: '/leave-types' }),
  createLeaveType: (input: LeaveTypeInput) => request<LeaveType>({ method: 'POST', url: '/leave-types', data: input }),
  updateLeaveType: (code: string, input: Partial<LeaveTypeInput>) => request<LeaveType>({ method: 'PUT', url: `/leave-types/${code}`, data: input }),
  deleteLeaveType: (code: string) => request<{ deactivated: boolean }>({ method: 'DELETE', url: `/leave-types/${code}` }),
  holidays: (year?: number) => request<Holiday[]>({ url: '/holidays', params: clean({ year }) }),
  createHoliday: (input: HolidayInput) => request<Holiday>({ method: 'POST', url: '/holidays', data: input }),
  updateHoliday: (id: string, input: Partial<HolidayInput>) => request<Holiday>({ method: 'PUT', url: `/holidays/${id}`, data: input }),
  deleteHoliday: (id: string) => request<void>({ method: 'DELETE', url: `/holidays/${id}` }),
  importHolidays: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ImportResult>({ method: 'POST', url: '/holidays/import', data: form });
  },
  departments: () => request<DepartmentView[]>({ url: '/departments' }),
  createDepartment: (input: DepartmentInput) => request<Department>({ method: 'POST', url: '/departments', data: input }),
  updateDepartment: (id: string, input: Partial<DepartmentInput>) => request<Department>({ method: 'PUT', url: `/departments/${id}`, data: input }),
  deleteDepartment: (id: string) => request<void>({ method: 'DELETE', url: `/departments/${id}` }),
};

export const notificationRepository = {
  list: () => request<NotificationList>({ url: '/notifications' }),
  markRead: (id: string) => request<Notification>({ method: 'PUT', url: `/notifications/${id}/read` }),
  markAllRead: () => request<{ updated: number }>({ method: 'PUT', url: '/notifications/read-all' }),
  remove: (id: string) => request<void>({ method: 'DELETE', url: `/notifications/${id}` }),
};

export const reportRepository = {
  leaveSummary: (f?: ReportFilters) => request<LeaveSummaryReport>({ url: '/reports/leave-summary', params: clean(f) }),
  departmentSummary: (f?: ReportFilters) => request<DepartmentSummaryReport>({ url: '/reports/department-summary', params: clean(f) }),
  handoverSummary: (f?: ReportFilters) => request<HandoverSummaryReport>({ url: '/reports/handover-summary', params: clean(f) }),
  exportExcel: (f?: ReportFilters) => downloadFile('/reports/export', clean(f), 'leaveflow-report.xlsx'),
};

export const systemRepository = {
  settings: () => request<OrgSettings>({ url: '/settings' }),
  updateSettings: (input: SettingsInput) => request<OrgSettings>({ method: 'PUT', url: '/settings', data: input }),
  workbook: () => request<WorkbookInfo>({ url: '/system/workbook' }),
  backup: () => request<{ fileName: string | null }>({ method: 'POST', url: '/system/workbook/backup' }),
  downloadWorkbook: () => downloadFile('/system/workbook/download', undefined, 'LeaveFlow.xlsx'),
  downloadBackup: (fileName: string) => downloadFile(`/system/workbook/backups/${encodeURIComponent(fileName)}`, undefined, fileName),
  auditLogs: (q?: { entityType?: string; limit?: number }) => request<(AuditLog & { actorName: string })[]>({ url: '/system/audit-logs', params: clean(q) }),
  runLifecycle: () => request<{ reminders: number; completed: number; overdue: number }>({ method: 'POST', url: '/system/lifecycle/run' }),
};
