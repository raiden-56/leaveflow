import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BalanceAdjustmentInput,
  CompOffInput,
  DepartmentInput,
  EmployeeInput,
  HandoverInput,
  HandoverTaskInput,
  HolidayInput,
  LeaveApplicationInput,
  LeaveTypeInput,
  ReportFilters,
  SettingsInput,
  TaskUpdateInput,
} from '@leaveflow/shared';
import type { ApiError } from '@/services/api/httpClient';
import {
  balanceRepository,
  dashboardRepository,
  employeeRepository,
  handoverRepository,
  leaveRepository,
  masterDataRepository,
  notificationRepository,
  reportRepository,
  systemRepository,
  type HandoverQuery,
  type LeaveQuery,
  type TaskQuery,
} from '@/services/repositories';

/** Adapts a repository call (Promise) to RTK Query's { data } | { error } contract. */
async function run<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await fn() };
  } catch (error) {
    return { error: error as ApiError };
  }
}

const TAGS = ['Leave', 'Handover', 'Task', 'Balance', 'Dashboard', 'Notification', 'Employee', 'LeaveType', 'Holiday', 'Department', 'Settings', 'Report', 'Workbook', 'Calendar'] as const;

/** Everything affected when a leave or handover changes state. */
const WORKFLOW = ['Leave', 'Handover', 'Task', 'Balance', 'Dashboard', 'Notification', 'Report', 'Calendar'] as const;

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: TAGS,
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (b) => ({
    // ---- dashboards ----
    employeeDashboard: b.query({ queryFn: (_: void) => run(dashboardRepository.employee), providesTags: ['Dashboard'] }),
    managerDashboard: b.query({ queryFn: (_: void) => run(dashboardRepository.manager), providesTags: ['Dashboard'] }),
    adminDashboard: b.query({ queryFn: (_: void) => run(dashboardRepository.admin), providesTags: ['Dashboard'] }),
    teamAvailability: b.query({
      queryFn: (q: { date?: string; department?: string } | void) => run(() => dashboardRepository.teamAvailability(q ?? undefined)),
      providesTags: ['Dashboard', 'Calendar'],
    }),

    // ---- leaves ----
    leaves: b.query({ queryFn: (q: LeaveQuery | void) => run(() => leaveRepository.list(q ?? undefined)), providesTags: ['Leave'] }),
    leave: b.query({ queryFn: (id: string) => run(() => leaveRepository.get(id)), providesTags: (_r, _e, id) => [{ type: 'Leave', id }, 'Leave'] }),
    calendar: b.query({
      queryFn: (q: Parameters<typeof leaveRepository.calendar>[0]) => run(() => leaveRepository.calendar(q)),
      providesTags: ['Calendar', 'Holiday'],
    }),
    applyLeave: b.mutation({ queryFn: (input: LeaveApplicationInput) => run(() => leaveRepository.apply(input)), invalidatesTags: [...WORKFLOW] }),
    updateLeave: b.mutation({
      queryFn: ({ id, input }: { id: string; input: LeaveApplicationInput }) => run(() => leaveRepository.update(id, input)),
      invalidatesTags: [...WORKFLOW],
    }),
    cancelLeave: b.mutation({ queryFn: ({ id, reason }: { id: string; reason?: string }) => run(() => leaveRepository.cancel(id, reason)), invalidatesTags: [...WORKFLOW] }),
    approveLeave: b.mutation({ queryFn: ({ id, comment }: { id: string; comment?: string }) => run(() => leaveRepository.approve(id, comment)), invalidatesTags: [...WORKFLOW] }),
    rejectLeave: b.mutation({ queryFn: ({ id, comment }: { id: string; comment: string }) => run(() => leaveRepository.reject(id, comment)), invalidatesTags: [...WORKFLOW] }),
    requestLeaveChanges: b.mutation({
      queryFn: ({ id, comment }: { id: string; comment: string }) => run(() => leaveRepository.requestChanges(id, comment)),
      invalidatesTags: [...WORKFLOW],
    }),

    // ---- balances ----
    myBalances: b.query({ queryFn: ({ employeeId, year }: { employeeId: string; year?: number }) => run(() => balanceRepository.forEmployee(employeeId, year)), providesTags: ['Balance'] }),
    allBalances: b.query({ queryFn: (year: number | void) => run(() => balanceRepository.all(year ?? undefined)), providesTags: ['Balance'] }),
    balanceTransactions: b.query({
      queryFn: ({ employeeId, year }: { employeeId: string; year?: number }) => run(() => balanceRepository.transactions(employeeId, year)),
      providesTags: ['Balance'],
    }),
    adjustBalance: b.mutation({
      queryFn: ({ employeeId, input }: { employeeId: string; input: BalanceAdjustmentInput }) => run(() => balanceRepository.adjust(employeeId, input)),
      invalidatesTags: ['Balance', 'Dashboard', 'Notification'],
    }),
    addCompOff: b.mutation({
      queryFn: ({ employeeId, input }: { employeeId: string; input: CompOffInput }) => run(() => balanceRepository.compOff(employeeId, input)),
      invalidatesTags: ['Balance', 'Dashboard', 'Notification'],
    }),
    yearEndRollover: b.mutation({ queryFn: (year: number) => run(() => balanceRepository.yearEnd(year)), invalidatesTags: ['Balance'] }),

    // ---- handovers ----
    handovers: b.query({ queryFn: (q: HandoverQuery | void) => run(() => handoverRepository.list(q ?? undefined)), providesTags: ['Handover'] }),
    handover: b.query({ queryFn: (id: string) => run(() => handoverRepository.get(id)), providesTags: (_r, _e, id) => [{ type: 'Handover', id }, 'Handover'] }),
    backupCandidates: b.query({
      queryFn: (q: { startDate: string; endDate: string; excludeLeaveId?: string }) => run(() => handoverRepository.candidates(q.startDate, q.endDate, q.excludeLeaveId)),
      providesTags: ['Handover'],
    }),
    createHandover: b.mutation({
      queryFn: ({ leaveId, input }: { leaveId: string; input: HandoverInput }) => run(() => handoverRepository.create(leaveId, input)),
      invalidatesTags: [...WORKFLOW],
    }),
    updateHandover: b.mutation({
      queryFn: ({ id, input }: { id: string; input: HandoverInput }) => run(() => handoverRepository.update(id, input)),
      invalidatesTags: [...WORKFLOW],
    }),
    acceptHandover: b.mutation({ queryFn: ({ id, comment }: { id: string; comment?: string }) => run(() => handoverRepository.accept(id, comment)), invalidatesTags: [...WORKFLOW] }),
    declineHandover: b.mutation({ queryFn: ({ id, comment }: { id: string; comment: string }) => run(() => handoverRepository.decline(id, comment)), invalidatesTags: [...WORKFLOW] }),
    completeHandover: b.mutation({ queryFn: ({ id, comment }: { id: string; comment?: string }) => run(() => handoverRepository.complete(id, comment)), invalidatesTags: [...WORKFLOW] }),
    tasks: b.query({ queryFn: (q: TaskQuery | void) => run(() => handoverRepository.tasks(q ?? undefined)), providesTags: ['Task'] }),
    addTask: b.mutation({
      queryFn: ({ handoverId, input }: { handoverId: string; input: HandoverTaskInput }) => run(() => handoverRepository.addTask(handoverId, input)),
      invalidatesTags: ['Task', 'Handover', 'Dashboard', 'Leave'],
    }),
    updateTask: b.mutation({
      queryFn: ({ taskId, input }: { taskId: string; input: TaskUpdateInput }) => run(() => handoverRepository.updateTask(taskId, input)),
      invalidatesTags: ['Task', 'Handover', 'Dashboard', 'Leave', 'Report'],
    }),
    deleteTask: b.mutation({ queryFn: (taskId: string) => run(() => handoverRepository.deleteTask(taskId)), invalidatesTags: ['Task', 'Handover', 'Dashboard', 'Leave'] }),

    // ---- employees ----
    employees: b.query({
      queryFn: (q: Parameters<typeof employeeRepository.list>[0] | void) => run(() => employeeRepository.list(q ?? undefined)),
      providesTags: ['Employee'],
    }),
    createEmployee: b.mutation({ queryFn: (input: EmployeeInput) => run(() => employeeRepository.create(input)), invalidatesTags: ['Employee', 'Dashboard', 'Department'] }),
    updateEmployee: b.mutation({
      queryFn: ({ id, input }: { id: string; input: EmployeeInput }) => run(() => employeeRepository.update(id, input)),
      invalidatesTags: ['Employee', 'Dashboard', 'Department', 'Leave'],
    }),
    deactivateEmployee: b.mutation({ queryFn: (id: string) => run(() => employeeRepository.deactivate(id)), invalidatesTags: ['Employee', 'Dashboard', 'Department'] }),
    importEmployees: b.mutation({ queryFn: (file: File) => run(() => employeeRepository.importExcel(file)), invalidatesTags: ['Employee', 'Dashboard', 'Department'] }),

    // ---- master data ----
    leaveTypes: b.query({ queryFn: (_: void) => run(masterDataRepository.leaveTypes), providesTags: ['LeaveType'] }),
    createLeaveType: b.mutation({ queryFn: (input: LeaveTypeInput) => run(() => masterDataRepository.createLeaveType(input)), invalidatesTags: ['LeaveType', 'Balance'] }),
    updateLeaveType: b.mutation({
      queryFn: ({ code, input }: { code: string; input: Partial<LeaveTypeInput> }) => run(() => masterDataRepository.updateLeaveType(code, input)),
      invalidatesTags: ['LeaveType', 'Balance', 'Dashboard'],
    }),
    deleteLeaveType: b.mutation({ queryFn: (code: string) => run(() => masterDataRepository.deleteLeaveType(code)), invalidatesTags: ['LeaveType', 'Balance'] }),
    holidays: b.query({ queryFn: (year: number | void) => run(() => masterDataRepository.holidays(year ?? undefined)), providesTags: ['Holiday'] }),
    createHoliday: b.mutation({ queryFn: (input: HolidayInput) => run(() => masterDataRepository.createHoliday(input)), invalidatesTags: ['Holiday', 'Calendar', 'Dashboard'] }),
    updateHoliday: b.mutation({
      queryFn: ({ id, input }: { id: string; input: Partial<HolidayInput> }) => run(() => masterDataRepository.updateHoliday(id, input)),
      invalidatesTags: ['Holiday', 'Calendar', 'Dashboard'],
    }),
    deleteHoliday: b.mutation({ queryFn: (id: string) => run(() => masterDataRepository.deleteHoliday(id)), invalidatesTags: ['Holiday', 'Calendar', 'Dashboard'] }),
    importHolidays: b.mutation({ queryFn: (file: File) => run(() => masterDataRepository.importHolidays(file)), invalidatesTags: ['Holiday', 'Calendar'] }),
    departments: b.query({ queryFn: (_: void) => run(masterDataRepository.departments), providesTags: ['Department'] }),
    createDepartment: b.mutation({ queryFn: (input: DepartmentInput) => run(() => masterDataRepository.createDepartment(input)), invalidatesTags: ['Department'] }),
    updateDepartment: b.mutation({
      queryFn: ({ id, input }: { id: string; input: Partial<DepartmentInput> }) => run(() => masterDataRepository.updateDepartment(id, input)),
      invalidatesTags: ['Department', 'Employee'],
    }),
    deleteDepartment: b.mutation({ queryFn: (id: string) => run(() => masterDataRepository.deleteDepartment(id)), invalidatesTags: ['Department'] }),

    // ---- notifications ----
    notifications: b.query({ queryFn: (_: void) => run(notificationRepository.list), providesTags: ['Notification'] }),
    markNotificationRead: b.mutation({ queryFn: (id: string) => run(() => notificationRepository.markRead(id)), invalidatesTags: ['Notification'] }),
    markAllNotificationsRead: b.mutation({ queryFn: (_: void) => run(notificationRepository.markAllRead), invalidatesTags: ['Notification'] }),
    deleteNotification: b.mutation({ queryFn: (id: string) => run(() => notificationRepository.remove(id)), invalidatesTags: ['Notification'] }),

    // ---- reports ----
    leaveSummary: b.query({ queryFn: (f: ReportFilters | void) => run(() => reportRepository.leaveSummary(f ?? undefined)), providesTags: ['Report'] }),
    departmentSummary: b.query({ queryFn: (f: ReportFilters | void) => run(() => reportRepository.departmentSummary(f ?? undefined)), providesTags: ['Report'] }),
    handoverSummary: b.query({ queryFn: (f: ReportFilters | void) => run(() => reportRepository.handoverSummary(f ?? undefined)), providesTags: ['Report'] }),

    // ---- settings & system ----
    settings: b.query({ queryFn: (_: void) => run(systemRepository.settings), providesTags: ['Settings'] }),
    updateSettings: b.mutation({ queryFn: (input: SettingsInput) => run(() => systemRepository.updateSettings(input)), invalidatesTags: ['Settings', ...WORKFLOW] }),
    workbookInfo: b.query({ queryFn: (_: void) => run(systemRepository.workbook), providesTags: ['Workbook'] }),
    createBackup: b.mutation({ queryFn: (_: void) => run(systemRepository.backup), invalidatesTags: ['Workbook'] }),
    auditLogs: b.query({ queryFn: (q: { entityType?: string; limit?: number } | void) => run(() => systemRepository.auditLogs(q ?? undefined)), providesTags: ['Workbook'] }),
    runLifecycle: b.mutation({ queryFn: (_: void) => run(systemRepository.runLifecycle), invalidatesTags: [...WORKFLOW] }),
  }),
});

export const {
  useEmployeeDashboardQuery,
  useManagerDashboardQuery,
  useAdminDashboardQuery,
  useTeamAvailabilityQuery,
  useLeavesQuery,
  useLeaveQuery,
  useCalendarQuery,
  useApplyLeaveMutation,
  useUpdateLeaveMutation,
  useCancelLeaveMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useRequestLeaveChangesMutation,
  useMyBalancesQuery,
  useAllBalancesQuery,
  useBalanceTransactionsQuery,
  useAdjustBalanceMutation,
  useAddCompOffMutation,
  useYearEndRolloverMutation,
  useHandoversQuery,
  useHandoverQuery,
  useBackupCandidatesQuery,
  useCreateHandoverMutation,
  useUpdateHandoverMutation,
  useAcceptHandoverMutation,
  useDeclineHandoverMutation,
  useCompleteHandoverMutation,
  useTasksQuery,
  useAddTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useImportEmployeesMutation,
  useLeaveTypesQuery,
  useCreateLeaveTypeMutation,
  useUpdateLeaveTypeMutation,
  useDeleteLeaveTypeMutation,
  useHolidaysQuery,
  useCreateHolidayMutation,
  useUpdateHolidayMutation,
  useDeleteHolidayMutation,
  useImportHolidaysMutation,
  useDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useLeaveSummaryQuery,
  useDepartmentSummaryQuery,
  useHandoverSummaryQuery,
  useSettingsQuery,
  useUpdateSettingsMutation,
  useWorkbookInfoQuery,
  useCreateBackupMutation,
  useAuditLogsQuery,
  useRunLifecycleMutation,
} = api;
