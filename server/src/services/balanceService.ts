import {
  balanceAvailable,
  balanceTotal,
  carryForwardAmount,
  round,
  type BalanceAdjustmentInput,
  type CompOffInput,
  type LeaveBalance,
  type LeaveBalanceView,
  type LeaveRequest,
  type LeaveTransaction,
  type LeaveType,
  type TransactionType,
} from '@leaveflow/shared';
import { notFound, validationError } from '../utils/errors.js';
import { leaveYear, nowIso, today, type Actor, type ServiceDeps } from './context.js';
import type { SettingsService } from './settingsService.js';
import type { AuditService } from './auditService.js';
import type { NotificationService } from './notifications/notificationService.js';

/**
 * Owns every change to leave balances. Each change is recorded in the
 * LeaveTransactions sheet so balances are fully auditable.
 *
 *   available = allocated + carriedForward + adjusted - used - pending
 */
export class BalanceService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async currentYear(): Promise<number> {
    const s = await this.settings.get();
    return leaveYear(today(this.deps, s), s.fiscalYearStartMonth);
  }

  async yearFor(date: string): Promise<number> {
    const s = await this.settings.get();
    return leaveYear(date, s.fiscalYearStartMonth);
  }

  toView(b: LeaveBalance, type: LeaveType | undefined): LeaveBalanceView {
    return {
      ...b,
      leaveTypeName: type?.name ?? b.leaveType,
      color: type?.color ?? '#64748B',
      trackBalance: type?.trackBalance ?? true,
      includeInTotals: type?.includeInTotals ?? true,
      total: balanceTotal(b),
      available: balanceAvailable(b),
    };
  }

  /** Balances for an employee & year, lazily creating allocation rows for every active, tracked leave type. */
  async getBalances(employeeId: string, year?: number): Promise<LeaveBalanceView[]> {
    const y = year ?? (await this.currentYear());
    const types = await this.deps.repos.leaveTypes.findAll();
    await this.ensureRows(employeeId, y, types);
    const rows = await this.deps.repos.balances.findFor(employeeId, y);
    const typeMap = new Map(types.map((t) => [t.code, t]));
    return rows
      .filter((r) => typeMap.get(r.leaveType)?.isActive !== false || r.used > 0 || r.pending > 0)
      .map((r) => this.toView(r, typeMap.get(r.leaveType)))
      .sort((a, b) => a.leaveTypeName.localeCompare(b.leaveTypeName));
  }

  async getBalance(employeeId: string, leaveTypeCode: string, year: number): Promise<LeaveBalanceView | undefined> {
    const type = await this.deps.repos.leaveTypes.findById(leaveTypeCode);
    if (!type) return undefined;
    await this.ensureRows(employeeId, year, [type]);
    const row = await this.deps.repos.balances.findOne(employeeId, year, leaveTypeCode);
    return row ? this.toView(row, type) : undefined;
  }

  async listAll(year?: number): Promise<(LeaveBalanceView & { employeeName: string; department: string })[]> {
    const y = year ?? (await this.currentYear());
    const employees = (await this.deps.repos.employees.findAll()).filter((e) => e.employmentStatus !== 'INACTIVE');
    const types = await this.deps.repos.leaveTypes.findAll();
    await this.deps.uow.run(async () => {
      for (const e of employees) await this.ensureRows(e.employeeId, y, types);
    });
    const typeMap = new Map(types.map((t) => [t.code, t]));
    const empMap = new Map(employees.map((e) => [e.employeeId, e]));
    const rows = await this.deps.repos.balances.findWhere((b) => b.year === y && empMap.has(b.employeeId));
    return rows.map((r) => ({
      ...this.toView(r, typeMap.get(r.leaveType)),
      employeeName: empMap.get(r.employeeId)!.employeeName,
      department: empMap.get(r.employeeId)!.department,
    }));
  }

  private async ensureRows(employeeId: string, year: number, types: LeaveType[]): Promise<void> {
    const existing = await this.deps.repos.balances.findFor(employeeId, year);
    const missing = types.filter((t) => t.isActive && t.trackBalance && !existing.some((b) => b.leaveType === t.code));
    if (missing.length === 0) return;
    await this.deps.uow.run(async () => {
      for (const t of missing) {
        await this.deps.repos.balances.create({
          employeeId,
          year,
          leaveType: t.code,
          allocated: t.annualAllocation,
          carriedForward: 0,
          adjusted: 0,
          used: 0,
          pending: 0,
        });
        await this.record(employeeId, t.code, year, 'ALLOCATION', t.annualAllocation, '', 'Annual allocation', 'SYSTEM');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Leave lifecycle movements
  // ---------------------------------------------------------------------------

  /** Leave submitted: reserve days as pending. */
  applyPending(leave: LeaveRequest, actorId: string) {
    return this.move(leave, { pending: +leave.totalDays }, 'APPLIED', leave.totalDays, 'Leave applied', actorId);
  }
  /** Pending request withdrawn/rejected: release the reserved days. */
  releasePending(leave: LeaveRequest, actorId: string, reason = 'Pending leave released') {
    return this.move(leave, { pending: -leave.totalDays }, 'RELEASED', -leave.totalDays, reason, actorId);
  }
  /** Approved: move pending -> used. */
  approve(leave: LeaveRequest, actorId: string) {
    return this.move(leave, { pending: -leave.totalDays, used: +leave.totalDays }, 'APPROVED', leave.totalDays, 'Leave approved', actorId);
  }
  /** Leave approved without approval workflow: debit straight to used. */
  debitDirect(leave: LeaveRequest, actorId: string) {
    return this.move(leave, { used: +leave.totalDays }, 'APPROVED', leave.totalDays, 'Leave auto-approved', actorId);
  }
  /** Approved leave cancelled: give the days back. */
  reverseUsed(leave: LeaveRequest, actorId: string) {
    return this.move(leave, { used: -leave.totalDays }, 'REVERSED', -leave.totalDays, 'Approved leave cancelled', actorId);
  }

  private async move(
    leave: LeaveRequest,
    delta: { pending?: number; used?: number },
    type: TransactionType,
    days: number,
    reason: string,
    actorId: string,
  ): Promise<void> {
    const leaveType = await this.deps.repos.leaveTypes.findById(leave.leaveType);
    if (!leaveType?.trackBalance || leave.totalDays === 0) return;
    const year = await this.yearFor(leave.startDate);
    await this.ensureRows(leave.employeeId, year, [leaveType]);
    const row = await this.deps.repos.balances.findOne(leave.employeeId, year, leave.leaveType);
    if (!row) return;
    await this.deps.repos.balances.update(row.balanceId, {
      pending: Math.max(0, round(row.pending + (delta.pending ?? 0))),
      used: Math.max(0, round(row.used + (delta.used ?? 0))),
    });
    await this.record(leave.employeeId, leave.leaveType, year, type, days, leave.leaveId, reason, actorId);
  }

  // ---------------------------------------------------------------------------
  // HR operations
  // ---------------------------------------------------------------------------

  async adjust(employeeId: string, input: BalanceAdjustmentInput, actor: Actor): Promise<LeaveBalanceView> {
    return this.deps.uow.run(async () => {
      const employee = await this.deps.repos.employees.findById(employeeId);
      if (!employee) throw notFound('Employee', employeeId);
      const type = await this.deps.repos.leaveTypes.findById(input.leaveType);
      if (!type) throw notFound('Leave type', input.leaveType);
      if (!type.trackBalance) throw validationError(`${type.name} does not track balances`);
      const year = input.year ?? (await this.currentYear());
      await this.ensureRows(employeeId, year, [type]);
      const row = (await this.deps.repos.balances.findOne(employeeId, year, type.code))!;
      const nextAdjusted = round(row.adjusted + input.days);
      if (balanceAvailable({ ...row, adjusted: nextAdjusted }) < 0) {
        throw validationError('Adjustment would make the available balance negative');
      }
      const updated = await this.deps.repos.balances.update(row.balanceId, { adjusted: nextAdjusted });
      await this.record(employeeId, type.code, year, 'ADJUSTMENT', input.days, '', input.reason, actor.employeeId);
      await this.audit.log(actor, 'BALANCE_ADJUSTED', 'LeaveBalance', row.balanceId, input);
      await this.notifications.notify({
        recipientIds: [employeeId],
        type: 'BALANCE_ADJUSTED',
        title: 'Leave balance updated',
        message: `HR ${input.days > 0 ? 'credited' : 'debited'} ${Math.abs(input.days)} day(s) of ${type.name}: ${input.reason}`,
        entityType: 'LeaveBalance',
        entityId: row.balanceId,
        link: '/my-leaves',
        excludeActorId: actor.employeeId,
      });
      return this.toView(updated, type);
    });
  }

  async addCompOff(employeeId: string, input: CompOffInput, actor: Actor): Promise<LeaveBalanceView> {
    return this.deps.uow.run(async () => {
      const type = await this.deps.repos.leaveTypes.findById('CO');
      if (!type) throw validationError('Compensatory Off leave type (code CO) is not configured');
      const year = await this.yearFor(input.workedOn);
      await this.ensureRows(employeeId, year, [type]);
      const row = await this.deps.repos.balances.findOne(employeeId, year, 'CO');
      if (!row) throw notFound('Balance');
      const updated = await this.deps.repos.balances.update(row.balanceId, { adjusted: round(row.adjusted + input.days) });
      await this.record(employeeId, 'CO', year, 'COMP_OFF', input.days, '', `Worked on ${input.workedOn}: ${input.reason}`, actor.employeeId);
      await this.audit.log(actor, 'COMP_OFF_ADDED', 'LeaveBalance', row.balanceId, input);
      await this.notifications.notify({
        recipientIds: [employeeId],
        type: 'BALANCE_ADJUSTED',
        title: 'Compensatory off credited',
        message: `${input.days} day(s) of comp-off credited for working on ${input.workedOn}.`,
        entityType: 'LeaveBalance',
        entityId: row.balanceId,
        link: '/my-leaves',
        excludeActorId: actor.employeeId,
      });
      return this.toView(updated, type);
    });
  }

  async transactions(employeeId: string, year?: number): Promise<LeaveTransaction[]> {
    const rows = await this.deps.repos.transactions.findWhere(
      (t) => t.employeeId === employeeId && (year === undefined || t.year === year),
    );
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.transactionId.localeCompare(a.transactionId));
  }

  /** Year-end rollover: creates next-year allocations and applies carry-forward rules. */
  async yearEndRollover(fromYear: number, actor: Actor): Promise<{ employees: number; carriedForward: number }> {
    return this.deps.uow.run(async () => {
      const types = (await this.deps.repos.leaveTypes.findAll()).filter((t) => t.isActive && t.trackBalance);
      const employees = (await this.deps.repos.employees.findAll()).filter((e) => e.employmentStatus !== 'INACTIVE');
      let carried = 0;
      for (const e of employees) {
        await this.ensureRows(e.employeeId, fromYear + 1, types);
        for (const t of types) {
          const prev = await this.deps.repos.balances.findOne(e.employeeId, fromYear, t.code);
          const next = await this.deps.repos.balances.findOne(e.employeeId, fromYear + 1, t.code);
          if (!prev || !next || next.carriedForward > 0) continue;
          const cf = carryForwardAmount(balanceAvailable(prev), t.allowCarryForward, t.maxCarryForward);
          if (cf <= 0) continue;
          await this.deps.repos.balances.update(next.balanceId, { carriedForward: cf });
          await this.record(e.employeeId, t.code, fromYear + 1, 'CARRY_FORWARD', cf, '', `Carried forward from ${fromYear}`, actor.employeeId);
          carried += cf;
        }
      }
      await this.audit.log(actor, 'YEAR_END_ROLLOVER', 'LeaveBalance', String(fromYear), { carried });
      return { employees: employees.length, carriedForward: round(carried) };
    });
  }

  private async record(
    employeeId: string,
    leaveType: string,
    year: number,
    transactionType: TransactionType,
    days: number,
    leaveId: string,
    reason: string,
    performedBy: string,
  ) {
    await this.deps.repos.transactions.create({
      employeeId,
      leaveType,
      year,
      transactionType,
      days,
      leaveId,
      reason,
      performedBy,
      createdAt: nowIso(this.deps),
    });
  }
}
