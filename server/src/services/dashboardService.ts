import {
  OPEN_HANDOVER_STATUSES,
  addDays,
  isTaskOverdue,
  monthKey,
  round,
  type AdminDashboard,
  type CalendarLeaveEvent,
  type EmployeeDashboard,
  type HandoverStats,
  type ManagerDashboard,
  type TeamAvailability,
  type TeamMemberAvailability,
} from '@leaveflow/shared';
import { dayjs } from '@leaveflow/shared';
import { forbidden } from '../utils/errors.js';
import { access, loadDirectory, toSummary, today, type Actor, type ServiceDeps } from './context.js';
import type { BalanceService } from './balanceService.js';
import type { HandoverService } from './handoverService.js';
import type { HolidayService } from './masterDataService.js';
import { toCalendarEvent, type LeaveService } from './leaveService.js';
import type { SettingsService } from './settingsService.js';

/** All dashboard figures are computed on demand from the persisted (Excel) data. */
export class DashboardService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly leaves: LeaveService,
    private readonly balances: BalanceService,
    private readonly handovers: HandoverService,
    private readonly holidays: HolidayService,
  ) {}

  async employee(actor: Actor): Promise<EmployeeDashboard> {
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const [balances, mine, created, assigned, holidays] = await Promise.all([
      this.balances.getBalances(actor.employeeId),
      this.leaves.list(actor, { scope: 'mine' }),
      this.handovers.list(actor, { scope: 'created' }),
      this.handovers.list(actor, { scope: 'assigned' }),
      this.holidays.list(),
    ]);
    const tracked = balances.filter((b) => b.trackBalance && b.includeInTotals);
    const handoverStats = this.handoverStats(created, assigned, todayStr);
    return {
      balances,
      totals: {
        allocated: round(tracked.reduce((s, b) => s + b.total, 0)),
        available: round(tracked.reduce((s, b) => s + b.available, 0)),
        used: round(tracked.reduce((s, b) => s + b.used, 0)),
        pending: round(tracked.reduce((s, b) => s + b.pending, 0)),
        pendingRequests: mine.filter((l) => l.status === 'PENDING' || l.status === 'CHANGES_REQUESTED').length,
      },
      upcomingLeaves: mine
        .filter((l) => l.endDate >= todayStr && ['APPROVED', 'PENDING', 'CHANGES_REQUESTED'].includes(l.status))
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5),
      recentLeaves: mine.slice(0, 8),
      handoverStats,
      assignedHandovers: assigned.filter((h) => OPEN_HANDOVER_STATUSES.includes(h.handoverStatus)).slice(0, 5),
      nextHoliday: holidays.find((h) => h.holidayDate >= todayStr && h.holidayType !== 'OPTIONAL'),
    };
  }

  private handoverStats(created: { handoverStatus: string; tasks: { taskStatus: string; dueDate: string; assignedEmployeeId: string }[] }[], assigned: typeof created, todayStr: string): HandoverStats {
    const all = [...created, ...assigned];
    return {
      createdActive: created.filter((h) => h.handoverStatus === 'ACTIVE').length,
      assignedActive: assigned.filter((h) => h.handoverStatus === 'ACTIVE').length,
      pendingAcceptance: all.filter((h) => h.handoverStatus === 'PENDING_ACCEPTANCE').length,
      accepted: all.filter((h) => h.handoverStatus === 'ACCEPTED').length,
      completed: all.filter((h) => h.handoverStatus === 'COMPLETED').length,
      tasksAssignedToBackups: created
        .filter((h) => OPEN_HANDOVER_STATUSES.includes(h.handoverStatus as never))
        .reduce((s, h) => s + h.tasks.length, 0),
      overdueTasks: all.reduce(
        (s, h) => s + h.tasks.filter((t) => isTaskOverdue(t as never, todayStr) && OPEN_HANDOVER_STATUSES.includes(h.handoverStatus as never)).length,
        0,
      ),
    };
  }

  async teamAvailability(actor: Actor, date?: string, department?: string): Promise<TeamAvailability> {
    const settings = await this.settings.get();
    const day = date ?? today(this.deps, settings);
    const dir = await loadDirectory(this.deps);
    const visible = access.teamIds(actor, dir);
    const members = dir
      .active()
      .filter((e) => !visible || visible.has(e.employeeId))
      .filter((e) => !department || e.department === department);
    const memberIds = new Set(members.map((m) => m.employeeId));
    const horizon = addDays(day, 30);
    const types = new Map((await this.deps.repos.leaveTypes.findAll()).map((t) => [t.code, t]));
    const leaves = (await this.deps.repos.leaves.findOverlapping(null, day, horizon, ['APPROVED', 'PENDING'])).filter((l) => memberIds.has(l.employeeId));
    const handovers = (await this.deps.repos.handovers.findAll()).filter((h) => OPEN_HANDOVER_STATUSES.includes(h.handoverStatus));
    const tasks = await this.deps.repos.tasks.findAll();

    const result: TeamMemberAvailability[] = members.map((m) => {
      const current = leaves.find((l) => l.employeeId === m.employeeId && l.status === 'APPROVED' && l.startDate <= day && l.endDate >= day);
      const next = leaves
        .filter((l) => l.employeeId === m.employeeId && l.startDate > day)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      const open = handovers.filter((h) => h.backupEmployeeId === m.employeeId);
      const openTasks = tasks.filter((t) => t.assignedEmployeeId === m.employeeId && t.taskStatus !== 'COMPLETED' && open.some((h) => h.handoverId === t.handoverId)).length;
      const isRemote = settings.remoteWorkEnabled && (m.workMode === 'REMOTE' || (m.workMode === 'HYBRID' && [1, 5].includes(dayjs(day).day())));
      return {
        ...toSummary(m)!,
        workMode: m.workMode,
        status: current ? 'ON_LEAVE' : isRemote ? 'REMOTE' : 'AVAILABLE',
        leave: current ? toCalendarEvent(current, dir, types.get(current.leaveType)) : undefined,
        nextLeave: next ? toCalendarEvent(next, dir, types.get(next.leaveType)) : undefined,
        openHandoversAsBackup: open.length,
        openTasks,
        isOverloaded: open.length >= settings.backupOverloadThreshold,
      };
    });
    const upcoming: CalendarLeaveEvent[] = leaves
      .filter((l) => l.startDate > day)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((l) => toCalendarEvent(l, dir, types.get(l.leaveType)));
    return {
      date: day,
      members: result,
      available: result.filter((r) => r.status === 'AVAILABLE'),
      onLeave: result.filter((r) => r.status === 'ON_LEAVE'),
      remote: result.filter((r) => r.status === 'REMOTE'),
      upcoming,
    };
  }

  async manager(actor: Actor): Promise<ManagerDashboard> {
    if (actor.role === 'EMPLOYEE') throw forbidden();
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const dir = await loadDirectory(this.deps);
    const managed = access.managedIds(actor, dir);
    const teamIds = managed ?? new Set(dir.active().map((e) => e.employeeId));
    const [teamLeaves, approvals, handovers, availability] = await Promise.all([
      this.leaves.list(actor, { scope: actor.role === 'ADMIN' ? 'all' : 'team' }),
      this.leaves.list(actor, { scope: 'approvals', status: 'PENDING' }),
      this.handovers.list(actor, { scope: 'team' }),
      this.teamAvailability(actor),
    ]);
    const workload = availability.members.filter((m) => teamIds.has(m.employeeId));
    const upcoming = teamLeaves
      .filter((l) => l.startDate > todayStr && ['APPROVED', 'PENDING'].includes(l.status))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const trend = Array.from({ length: 6 }, (_, i) => dayjs(todayStr).subtract(5 - i, 'month').format('YYYY-MM'));
    return {
      cards: {
        teamMembers: teamIds.size,
        onLeaveToday: workload.filter((m) => m.status === 'ON_LEAVE').length,
        pendingApprovals: approvals.length,
        upcomingLeaves: upcoming.length,
        pendingHandoverAcceptance: handovers.filter((h) => h.handoverStatus === 'PENDING_ACCEPTANCE').length,
        activeHandovers: handovers.filter((h) => h.handoverStatus === 'ACTIVE').length,
      },
      pendingApprovals: approvals.slice(0, 8),
      upcomingLeaves: upcoming.slice(0, 8),
      workload,
      leaveTrend: trend.map((month) => ({
        month,
        days: round(teamLeaves.filter((l) => l.status === 'APPROVED' && monthKey(l.startDate) === month).reduce((s, l) => s + l.totalDays, 0)),
      })),
    };
  }

  async admin(actor: Actor): Promise<AdminDashboard> {
    if (actor.role !== 'ADMIN') throw forbidden();
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const year = todayStr.slice(0, 4);
    const dir = await loadDirectory(this.deps);
    const [all, departments, types, handovers] = await Promise.all([
      this.leaves.list(actor, { scope: 'all' }),
      this.deps.repos.departments.findAll(),
      this.deps.repos.leaveTypes.findAll(),
      this.deps.repos.handovers.findAll(),
    ]);
    const thisYear = all.filter((l) => l.startDate.startsWith(year));
    const approved = thisYear.filter((l) => l.status === 'APPROVED');
    const onLeave = all.filter((l) => l.status === 'APPROVED' && l.startDate <= todayStr && l.endDate >= todayStr);
    const closed = handovers.filter((h) => ['ACTIVE', 'COMPLETED'].includes(h.handoverStatus));
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const typeMap = new Map(types.map((t) => [t.code, t]));
    return {
      cards: {
        totalEmployees: dir.active().length,
        totalLeavesTaken: round(approved.filter((l) => l.startDate <= todayStr).reduce((s, l) => s + l.totalDays, 0)),
        pendingApprovals: all.filter((l) => l.status === 'PENDING').length,
        approvedLeaves: approved.length,
        rejectedLeaves: thisYear.filter((l) => l.status === 'REJECTED').length,
        onLeaveToday: onLeave.length,
        handoverCompletionRate: closed.length ? Math.round((closed.filter((h) => h.handoverStatus === 'COMPLETED').length / closed.length) * 100) : 0,
      },
      departmentDistribution: departments.map((d) => ({
        department: d.departmentName,
        color: d.color,
        employees: dir.active().filter((e) => e.department === d.departmentName).length,
        days: round(approved.filter((l) => l.employee?.department === d.departmentName).reduce((s, l) => s + l.totalDays, 0)),
      })),
      monthlyTrend: months.map((m) => ({
        month: m,
        approved: round(thisYear.filter((l) => l.status === 'APPROVED' && monthKey(l.startDate) === m).reduce((s, l) => s + l.totalDays, 0)),
        pending: round(thisYear.filter((l) => l.status === 'PENDING' && monthKey(l.startDate) === m).reduce((s, l) => s + l.totalDays, 0)),
        rejected: round(thisYear.filter((l) => l.status === 'REJECTED' && monthKey(l.startDate) === m).reduce((s, l) => s + l.totalDays, 0)),
      })),
      typeDistribution: [...new Set(approved.map((l) => l.leaveType))].map((code) => ({
        leaveType: code,
        name: typeMap.get(code)?.name ?? code,
        color: typeMap.get(code)?.color ?? '#64748B',
        days: round(approved.filter((l) => l.leaveType === code).reduce((s, l) => s + l.totalDays, 0)),
      })).sort((a, b) => b.days - a.days),
      recentRequests: all.slice(0, 8),
      onLeaveToday: onLeave.map((l) => toCalendarEvent(l, dir, typeMap.get(l.leaveType))),
    };
  }
}
