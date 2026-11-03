import {
  HANDOVER_STATUSES,
  TASK_STATUSES,
  isTaskOverdue,
  monthKey,
  round,
  type DepartmentSummaryReport,
  type HandoverStatus,
  type HandoverSummaryReport,
  type LeaveSummaryReport,
  type ReportFilters,
  type TaskStatus,
} from '@leaveflow/shared';
import { dayjs } from '@leaveflow/shared';
import { forbidden } from '../utils/errors.js';
import { access, loadDirectory, today, type Actor, type ServiceDeps } from './context.js';
import type { LeaveService } from './leaveService.js';
import type { SettingsService } from './settingsService.js';

export class ReportService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly leaves: LeaveService,
  ) {}

  private async range(filters: ReportFilters) {
    const todayStr = today(this.deps, await this.settings.get());
    return {
      from: filters.from || `${todayStr.slice(0, 4)}-01-01`,
      to: filters.to || `${todayStr.slice(0, 4)}-12-31`,
      todayStr,
    };
  }

  private scopeFor(actor: Actor) {
    if (actor.role === 'EMPLOYEE') throw forbidden('Reports are available to managers and HR');
    return actor.role === 'ADMIN' ? ('all' as const) : ('team' as const);
  }

  async leaveSummary(actor: Actor, filters: ReportFilters = {}): Promise<LeaveSummaryReport> {
    const { from, to } = await this.range(filters);
    const rows = await this.leaves.list(actor, {
      scope: this.scopeFor(actor),
      from,
      to,
      department: filters.department,
      employeeId: filters.employeeId,
      leaveType: filters.leaveType,
    });
    const months: string[] = [];
    for (let m = dayjs(from).startOf('month'); !m.isAfter(dayjs(to), 'month'); m = m.add(1, 'month')) months.push(m.format('YYYY-MM'));
    const sumDays = (list: typeof rows) => round(list.reduce((s, l) => s + l.totalDays, 0));
    const byStatus = (s: string) => rows.filter((l) => l.status === s);
    const types = [...new Set(rows.map((r) => r.leaveType))];
    const employees = [...new Set(rows.map((r) => r.employeeId))];
    const approved = byStatus('APPROVED');
    return {
      from,
      to,
      totals: {
        requests: rows.length,
        days: sumDays(approved),
        approved: approved.length,
        pending: byStatus('PENDING').length,
        rejected: byStatus('REJECTED').length,
        cancelled: byStatus('CANCELLED').length,
      },
      byMonth: months.map((month) => {
        const inMonth = rows.filter((l) => monthKey(l.startDate) === month);
        return {
          month,
          approved: inMonth.filter((l) => l.status === 'APPROVED').length,
          pending: inMonth.filter((l) => l.status === 'PENDING').length,
          rejected: inMonth.filter((l) => l.status === 'REJECTED').length,
          days: sumDays(inMonth.filter((l) => l.status === 'APPROVED')),
        };
      }),
      byType: types
        .map((code) => {
          const list = rows.filter((l) => l.leaveType === code);
          return {
            leaveType: code,
            name: list[0].leaveTypeName,
            color: list[0].leaveTypeColor,
            days: sumDays(list.filter((l) => l.status === 'APPROVED')),
            requests: list.length,
          };
        })
        .sort((a, b) => b.days - a.days),
      byEmployee: employees
        .map((id) => {
          const list = rows.filter((l) => l.employeeId === id);
          return {
            employeeId: id,
            employeeName: list[0].employee?.employeeName ?? id,
            department: list[0].employee?.department ?? '',
            days: sumDays(list.filter((l) => l.status === 'APPROVED')),
            requests: list.length,
          };
        })
        .sort((a, b) => b.days - a.days),
      pending: byStatus('PENDING'),
    };
  }

  async departmentSummary(actor: Actor, filters: ReportFilters = {}): Promise<DepartmentSummaryReport> {
    const { from, to, todayStr } = await this.range(filters);
    const dir = await loadDirectory(this.deps);
    const managed = access.managedIds(actor, dir);
    const rows = await this.leaves.list(actor, { scope: this.scopeFor(actor), from, to });
    const departments = await this.deps.repos.departments.findAll();
    return {
      departments: departments
        .map((d) => {
          const employees = dir.active().filter((e) => e.department === d.departmentName && (!managed || managed.has(e.employeeId)));
          const list = rows.filter((l) => l.employee?.department === d.departmentName);
          const approved = list.filter((l) => l.status === 'APPROVED');
          const days = round(approved.reduce((s, l) => s + l.totalDays, 0));
          return {
            department: d.departmentName,
            color: d.color,
            employees: employees.length,
            requests: list.length,
            days,
            averageDaysPerEmployee: employees.length ? round(days / employees.length) : 0,
            onLeaveToday: approved.filter((l) => l.startDate <= todayStr && l.endDate >= todayStr).length,
          };
        })
        .filter((d) => d.employees > 0 || d.requests > 0),
    };
  }

  async handoverSummary(actor: Actor, filters: ReportFilters = {}): Promise<HandoverSummaryReport> {
    const { from, to, todayStr } = await this.range(filters);
    this.scopeFor(actor);
    const dir = await loadDirectory(this.deps);
    const managed = access.managedIds(actor, dir);
    const handovers = (await this.deps.repos.handovers.findAll()).filter(
      (h) => (!managed || managed.has(h.employeeId)) && h.endDate >= from && h.startDate <= to && (!filters.department || dir.get(h.employeeId)?.department === filters.department),
    );
    const ids = new Set(handovers.map((h) => h.handoverId));
    const tasks = (await this.deps.repos.tasks.findAll()).filter((t) => ids.has(t.handoverId));
    const totals = Object.fromEntries(HANDOVER_STATUSES.map((s) => [s, 0])) as Record<HandoverStatus, number>;
    handovers.forEach((h) => totals[h.handoverStatus]++);
    const taskTotals = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    tasks.forEach((t) => taskTotals[t.taskStatus]++);
    const closed = totals.ACTIVE + totals.COMPLETED;
    const backups = [...new Set(handovers.map((h) => h.backupEmployeeId))];
    const months: string[] = [];
    for (let m = dayjs(from).startOf('month'); !m.isAfter(dayjs(to), 'month'); m = m.add(1, 'month')) months.push(m.format('YYYY-MM'));
    return {
      totals,
      completionRate: closed ? Math.round((totals.COMPLETED / closed) * 100) : 0,
      taskTotals,
      overdueTasks: tasks.filter((t) => isTaskOverdue(t, todayStr)).length,
      byBackup: backups
        .map((id) => {
          const hs = handovers.filter((h) => h.backupEmployeeId === id);
          const ts = tasks.filter((t) => t.assignedEmployeeId === id);
          return {
            employeeId: id,
            employeeName: dir.name(id),
            handovers: hs.length,
            tasks: ts.length,
            completedTasks: ts.filter((t) => t.taskStatus === 'COMPLETED').length,
          };
        })
        .sort((a, b) => b.handovers - a.handovers),
      byMonth: months.map((month) => ({
        month,
        created: handovers.filter((h) => monthKey(h.createdAt.slice(0, 10)) === month).length,
        completed: handovers.filter((h) => h.completedDate && monthKey(h.completedDate.slice(0, 10)) === month).length,
      })),
    };
  }
}
