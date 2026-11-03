import {
  ACTIVE_LEAVE_STATUSES,
  LEAVE_STATUS_LABELS,
  addDays,
  calculateLeaveDays,
  calendarSpan,
  canTransitionLeave,
  diffDays,
  eachDay,
  rangesOverlap,
  type ApprovalAction,
  type CalendarLeaveEvent,
  type Employee,
  type InsightWarning,
  type LeaveApplicationInput,
  type LeaveDetails,
  type LeaveInsights,
  type LeavePreview,
  type LeavePreviewInput,
  type LeaveRequest,
  type LeaveRequestView,
  type LeaveStatus,
  type LeaveType,
} from '@leaveflow/shared';
import { assertNoErrors, forbidden, notFound, validationError } from '../utils/errors.js';
import { Directory, access, loadDirectory, nowIso, today, type Actor, type ServiceDeps } from './context.js';
import type { AuditService } from './auditService.js';
import type { BalanceService } from './balanceService.js';
import type { HandoverService } from './handoverService.js';
import type { HolidayService } from './masterDataService.js';
import type { NotificationService } from './notifications/notificationService.js';
import type { SettingsService } from './settingsService.js';

export interface LeaveFilters {
  scope?: 'mine' | 'team' | 'all' | 'approvals';
  status?: LeaveStatus;
  leaveType?: string;
  department?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CalendarFilters {
  from: string;
  to: string;
  department?: string;
  leaveType?: string;
  employeeId?: string;
  includePending?: boolean;
}

interface Evaluation extends LeavePreview {
  leaveType?: LeaveType;
}

export class LeaveService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly holidays: HolidayService,
    private readonly balances: BalanceService,
    private readonly handovers: HandoverService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Validation / preview
  // ---------------------------------------------------------------------------

  /** Runs every leave policy rule. Used by the live preview in the UI and before every write. */
  async evaluate(employee: Employee, input: LeavePreviewInput & { attachmentName?: string }): Promise<Evaluation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const leaveType = await this.deps.repos.leaveTypes.findById(input.leaveType);

    if (!leaveType || !leaveType.isActive) {
      return { totalDays: 0, days: [], errors: ['Select an active leave type'], warnings };
    }
    if (input.endDate < input.startDate) errors.push('End date cannot be before start date');
    if (input.halfDay !== 'NONE' && !leaveType.allowHalfDay) errors.push(`${leaveType.name} cannot be taken as a half day`);
    if (input.halfDay !== 'NONE' && input.startDate !== input.endDate) errors.push('Half day is only allowed for single-day leave');

    const { totalDays, days } = calculateLeaveDays({
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay,
      workingDays: settings.workingDays,
      holidays: await this.holidays.nonWorking(),
      excludeNonWorkingDays: leaveType.excludeWeekendsAndHolidays,
    });
    if (errors.length === 0 && totalDays === 0) errors.push('The selected dates fall entirely on weekends or holidays');

    const earliest = addDays(todayStr, -leaveType.backdatedDays);
    if (input.startDate < earliest) {
      errors.push(
        leaveType.backdatedDays > 0
          ? `${leaveType.name} can be backdated by at most ${leaveType.backdatedDays} day(s)`
          : 'Leave cannot start in the past',
      );
    } else if (input.startDate >= todayStr && leaveType.minNoticeDays > 0 && diffDays(todayStr, input.startDate) < leaveType.minNoticeDays) {
      errors.push(`${leaveType.name} requires at least ${leaveType.minNoticeDays} day(s) notice`);
    }

    const span = calendarSpan(input.startDate, input.endDate);
    if (leaveType.maxConsecutiveDays > 0 && span > leaveType.maxConsecutiveDays) {
      errors.push(`${leaveType.name} cannot exceed ${leaveType.maxConsecutiveDays} consecutive day(s)`);
    }

    const overlaps = (
      await this.deps.repos.leaves.findOverlapping([employee.employeeId], input.startDate, input.endDate, ACTIVE_LEAVE_STATUSES)
    ).filter((l) => l.leaveId !== input.excludeLeaveId);
    for (const o of overlaps) {
      errors.push(`Overlaps with your ${LEAVE_STATUS_LABELS[o.status].toLowerCase()} leave ${o.leaveId} (${o.startDate} → ${o.endDate})`);
    }

    let balance;
    if (leaveType.trackBalance) {
      const year = await this.balances.yearFor(input.startDate);
      balance = await this.balances.getBalance(employee.employeeId, leaveType.code, year);
      if (balance) {
        // When editing, the existing request's pending days are already reserved.
        let reserved = 0;
        if (input.excludeLeaveId) {
          const existing = await this.deps.repos.leaves.findById(input.excludeLeaveId);
          if (existing && existing.leaveType === leaveType.code && ['PENDING', 'CHANGES_REQUESTED'].includes(existing.status)) {
            reserved = existing.totalDays;
          }
        }
        const available = balance.available + reserved;
        if (totalDays > available) {
          errors.push(`Insufficient ${leaveType.name} balance: requested ${totalDays} day(s), available ${available}`);
        } else if (totalDays > 0 && available - totalDays < 1) {
          warnings.push(`This request will use almost all of your ${leaveType.name} balance`);
        }
      }
    } else if (!leaveType.isPaid) {
      warnings.push(`${leaveType.name} is unpaid and will be deducted from salary`);
    }

    if (leaveType.requiresAttachmentAfterDays > 0 && totalDays > leaveType.requiresAttachmentAfterDays && !input.attachmentName) {
      const msg = `A supporting document is required for ${leaveType.name} longer than ${leaveType.requiresAttachmentAfterDays} day(s)`;
      // The live preview has no file yet, so it only warns; submission enforces it.
      if (input.attachmentName === undefined) warnings.push(msg);
      else errors.push(msg);
    }
    const holidaysInRange = days.filter((d) => d.reason === 'HOLIDAY');
    // Public and company holidays both end up here, so don't call them all "public".
    if (holidaysInRange.length) warnings.push(`${holidaysInRange.length} holiday(s) in this range are not counted`);

    return { totalDays, days, balance, errors: [...new Set(errors)], warnings, leaveType };
  }

  async preview(actor: Actor, input: LeavePreviewInput): Promise<LeavePreview> {
    const { leaveType: _t, ...rest } = await this.evaluate(actor, input);
    return rest;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  async apply(actor: Actor, input: LeaveApplicationInput): Promise<LeaveDetails> {
    const leaveId = await this.deps.uow.run(async () => {
      const settings = await this.settings.get();
      const evaluation = await this.evaluate(actor, { ...input, excludeLeaveId: '' });
      const errors = [...evaluation.errors];
      if (settings.requireHandover && !input.handover) errors.push('A work handover is required for every leave request');
      if (input.handover) {
        const check = await this.handovers.checkAssignment(actor, input.handover, input);
        errors.push(...check.errors);
      }
      assertNoErrors(errors);
      const leaveType = evaluation.leaveType!;
      const approverId = await this.resolveApprover(actor);
      const autoApprove = !leaveType.requiresApproval;
      const todayStr = today(this.deps, settings);

      const leave = await this.deps.repos.leaves.create({
        employeeId: actor.employeeId,
        leaveType: leaveType.code,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays: evaluation.totalDays,
        halfDay: input.halfDay,
        reason: input.reason,
        appliedDate: todayStr,
        status: autoApprove ? 'APPROVED' : 'PENDING',
        approverId: autoApprove ? 'SYSTEM' : approverId,
        approvalDate: autoApprove ? todayStr : '',
        rejectionReason: '',
        managerComment: '',
        emergencyContact: input.emergencyContact,
        contactDuringLeave: input.contactDuringLeave,
        attachmentName: input.attachmentName,
        attachmentUrl: input.attachmentUrl,
        updatedAt: nowIso(this.deps),
      });
      if (autoApprove) await this.balances.debitDirect(leave, actor.employeeId);
      else await this.balances.applyPending(leave, actor.employeeId);
      await this.record(leave.leaveId, 'SUBMITTED', actor.employeeId, input.reason);
      if (input.handover) await this.handovers.createForLeave(leave, actor, input.handover, actor);

      await this.notifications.notify({
        recipientIds: autoApprove ? [] : [approverId],
        type: 'LEAVE_SUBMITTED',
        title: 'Leave approval required',
        message: `${actor.employeeName} applied for ${evaluation.totalDays} day(s) of ${leaveType.name} (${input.startDate} → ${input.endDate}).`,
        entityType: 'Leave',
        entityId: leave.leaveId,
        link: `/approvals?leave=${leave.leaveId}`,
      });
      await this.notifications.notify({
        recipientIds: [actor.employeeId],
        type: autoApprove ? 'LEAVE_APPROVED' : 'LEAVE_SUBMITTED',
        title: autoApprove ? 'Leave recorded' : 'Leave request submitted',
        message: `Your ${leaveType.name} request ${leave.leaveId} for ${evaluation.totalDays} day(s) was ${autoApprove ? 'recorded' : 'submitted for approval'}.`,
        entityType: 'Leave',
        entityId: leave.leaveId,
        link: `/my-leaves?leave=${leave.leaveId}`,
      });
      await this.audit.log(actor, 'LEAVE_APPLIED', 'Leave', leave.leaveId, { days: evaluation.totalDays, type: leaveType.code });
      return leave.leaveId;
    });
    return this.getDetails(actor, leaveId);
  }

  /** Edit & resubmit (allowed while pending or after the manager requested changes). */
  async update(actor: Actor, id: string, input: LeaveApplicationInput): Promise<LeaveDetails> {
    await this.deps.uow.run(async () => {
      const existing = await this.requireLeave(id);
      if (existing.employeeId !== actor.employeeId) throw forbidden('Only the applicant can edit this leave');
      if (!['PENDING', 'CHANGES_REQUESTED'].includes(existing.status)) {
        throw validationError(`A ${LEAVE_STATUS_LABELS[existing.status].toLowerCase()} leave cannot be edited`);
      }
      const settings = await this.settings.get();
      const evaluation = await this.evaluate(actor, { ...input, excludeLeaveId: id });
      const errors = [...evaluation.errors];
      if (settings.requireHandover && !input.handover) errors.push('A work handover is required for every leave request');
      if (input.handover) errors.push(...(await this.handovers.checkAssignment(actor, input.handover, input, id)).errors);
      assertNoErrors(errors);

      await this.balances.releasePending(existing, actor.employeeId, 'Leave edited — previous reservation released');
      const updated = await this.deps.repos.leaves.update(id, {
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays: evaluation.totalDays,
        halfDay: input.halfDay,
        reason: input.reason,
        emergencyContact: input.emergencyContact,
        contactDuringLeave: input.contactDuringLeave,
        attachmentName: input.attachmentName || existing.attachmentName,
        attachmentUrl: input.attachmentUrl || existing.attachmentUrl,
        status: 'PENDING',
        updatedAt: nowIso(this.deps),
      });
      await this.balances.applyPending(updated, actor.employeeId);

      const handover = await this.deps.repos.handovers.findByLeave(id);
      if (input.handover) {
        if (handover) await this.handovers.updateForLeave(handover, actor, input.handover, actor);
        else await this.handovers.createForLeave(updated, actor, input.handover, actor);
      }
      await this.record(id, 'RESUBMITTED', actor.employeeId, 'Request updated by employee');
      await this.notifications.notify({
        recipientIds: [existing.approverId],
        type: 'LEAVE_SUBMITTED',
        title: 'Leave request updated',
        message: `${actor.employeeName} updated leave ${id} (${input.startDate} → ${input.endDate}) and resubmitted it for approval.`,
        entityType: 'Leave',
        entityId: id,
        link: `/approvals?leave=${id}`,
      });
      await this.audit.log(actor, 'LEAVE_UPDATED', 'Leave', id);
    });
    return this.getDetails(actor, id);
  }

  async cancel(actor: Actor, id: string, reason = ''): Promise<LeaveDetails> {
    await this.deps.uow.run(async () => {
      const leave = await this.requireLeave(id);
      if (leave.employeeId !== actor.employeeId && !access.isAdmin(actor)) throw forbidden('Only the applicant or HR can cancel this leave');
      this.assertTransition(leave, 'CANCELLED');
      const todayStr = today(this.deps, await this.settings.get());
      if (leave.status === 'APPROVED' && leave.startDate <= todayStr && !access.isAdmin(actor)) {
        throw validationError('Leave that has already started can only be cancelled by HR');
      }
      if (leave.status === 'APPROVED') await this.balances.reverseUsed(leave, actor.employeeId);
      else await this.balances.releasePending(leave, actor.employeeId, 'Leave cancelled');
      const updated = await this.deps.repos.leaves.update(id, { status: 'CANCELLED', managerComment: reason || leave.managerComment, updatedAt: nowIso(this.deps) });
      await this.handovers.syncWithLeave(updated, actor);
      await this.record(id, 'CANCELLED', actor.employeeId, reason);
      await this.notifications.notify({
        recipientIds: [leave.approverId, leave.employeeId],
        type: 'LEAVE_CANCELLED',
        title: 'Leave cancelled',
        message: `Leave ${id} (${leave.startDate} → ${leave.endDate}) was cancelled by ${actor.employeeName}.`,
        entityType: 'Leave',
        entityId: id,
        link: `/my-leaves?leave=${id}`,
        excludeActorId: actor.employeeId,
      });
      await this.audit.log(actor, 'LEAVE_CANCELLED', 'Leave', id, { reason });
    });
    return this.getDetails(actor, id);
  }

  async approve(actor: Actor, id: string, comment = ''): Promise<LeaveDetails> {
    await this.deps.uow.run(async () => {
      const leave = await this.requireLeave(id);
      await this.assertCanDecide(actor, leave);
      this.assertTransition(leave, 'APPROVED');
      const settings = await this.settings.get();
      const handover = await this.deps.repos.handovers.findByLeave(id);
      if (settings.requireHandoverAcceptanceBeforeApproval && handover && !['ACCEPTED', 'ACTIVE'].includes(handover.handoverStatus)) {
        throw validationError('The backup employee must accept the work handover before this leave can be approved');
      }
      await this.balances.approve(leave, actor.employeeId);
      const updated = await this.deps.repos.leaves.update(id, {
        status: 'APPROVED',
        approverId: actor.employeeId,
        approvalDate: today(this.deps, settings),
        managerComment: comment,
        rejectionReason: '',
        updatedAt: nowIso(this.deps),
      });
      await this.handovers.syncWithLeave(updated, actor);
      await this.record(id, 'APPROVED', actor.employeeId, comment);
      await this.notifications.notify({
        recipientIds: [leave.employeeId],
        type: 'LEAVE_APPROVED',
        title: 'Leave approved',
        message: `${actor.employeeName} approved your leave ${id} (${leave.startDate} → ${leave.endDate})${comment ? `: ${comment}` : '.'}`,
        entityType: 'Leave',
        entityId: id,
        link: `/my-leaves?leave=${id}`,
      });
      await this.audit.log(actor, 'LEAVE_APPROVED', 'Leave', id, { comment });
    });
    return this.getDetails(actor, id);
  }

  async reject(actor: Actor, id: string, reason: string): Promise<LeaveDetails> {
    await this.deps.uow.run(async () => {
      const leave = await this.requireLeave(id);
      await this.assertCanDecide(actor, leave);
      this.assertTransition(leave, 'REJECTED');
      await this.balances.releasePending(leave, actor.employeeId, 'Leave rejected');
      const updated = await this.deps.repos.leaves.update(id, {
        status: 'REJECTED',
        approverId: actor.employeeId,
        approvalDate: today(this.deps, await this.settings.get()),
        rejectionReason: reason,
        updatedAt: nowIso(this.deps),
      });
      await this.handovers.syncWithLeave(updated, actor);
      await this.record(id, 'REJECTED', actor.employeeId, reason);
      await this.notifications.notify({
        recipientIds: [leave.employeeId],
        type: 'LEAVE_REJECTED',
        title: 'Leave rejected',
        message: `${actor.employeeName} rejected your leave ${id}: ${reason}`,
        entityType: 'Leave',
        entityId: id,
        link: `/my-leaves?leave=${id}`,
      });
      await this.audit.log(actor, 'LEAVE_REJECTED', 'Leave', id, { reason });
    });
    return this.getDetails(actor, id);
  }

  async requestChanges(actor: Actor, id: string, comment: string): Promise<LeaveDetails> {
    await this.deps.uow.run(async () => {
      const leave = await this.requireLeave(id);
      await this.assertCanDecide(actor, leave);
      this.assertTransition(leave, 'CHANGES_REQUESTED');
      await this.deps.repos.leaves.update(id, { status: 'CHANGES_REQUESTED', managerComment: comment, updatedAt: nowIso(this.deps) });
      await this.record(id, 'CHANGES_REQUESTED', actor.employeeId, comment);
      await this.notifications.notify({
        recipientIds: [leave.employeeId],
        type: 'LEAVE_CHANGES_REQUESTED',
        title: 'Changes requested on your leave',
        message: `${actor.employeeName} requested changes to leave ${id}: ${comment}`,
        entityType: 'Leave',
        entityId: id,
        link: `/apply-leave?edit=${id}`,
      });
      await this.audit.log(actor, 'LEAVE_CHANGES_REQUESTED', 'Leave', id, { comment });
    });
    return this.getDetails(actor, id);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(actor: Actor, filters: LeaveFilters = {}): Promise<LeaveRequestView[]> {
    const [dir, leaves, types, handovers, tasks, settings] = await Promise.all([
      loadDirectory(this.deps),
      this.deps.repos.leaves.findAll(),
      this.deps.repos.leaveTypes.findAll(),
      this.deps.repos.handovers.findAll(),
      this.deps.repos.tasks.findAll(),
      this.settings.get(),
    ]);
    const todayStr = today(this.deps, settings);
    const typeMap = new Map(types.map((t) => [t.code, t]));
    const handoverMap = new Map(handovers.map((h) => [h.leaveId, h]));
    const managed = access.managedIds(actor, dir);
    const scope = filters.scope ?? 'mine';
    if ((scope === 'team' || scope === 'approvals') && actor.role === 'EMPLOYEE') throw forbidden();
    if (scope === 'all' && actor.role !== 'ADMIN') throw forbidden();
    const q = filters.search?.trim().toLowerCase();

    return leaves
      .filter((l) => {
        if (scope === 'mine') return l.employeeId === actor.employeeId;
        if (scope === 'team') return managed === null || managed.has(l.employeeId);
        if (scope === 'approvals') {
          if (l.employeeId === actor.employeeId && !(access.isAdmin(actor) && settings.allowSelfApprovalForAdmins)) return false;
          return managed === null || managed.has(l.employeeId) || l.approverId === actor.employeeId;
        }
        return true;
      })
      .filter((l) => !filters.status || l.status === filters.status)
      .filter((l) => !filters.leaveType || l.leaveType === filters.leaveType)
      .filter((l) => !filters.employeeId || l.employeeId === filters.employeeId)
      .filter((l) => !filters.department || dir.get(l.employeeId)?.department === filters.department)
      .filter((l) => !filters.from || l.endDate >= filters.from)
      .filter((l) => !filters.to || l.startDate <= filters.to)
      .filter((l) => !q || [l.leaveId, l.reason, dir.name(l.employeeId), typeMap.get(l.leaveType)?.name ?? ''].some((v) => v.toLowerCase().includes(q)))
      .map((l) => {
        const h = handoverMap.get(l.leaveId);
        return this.toView(l, dir, typeMap.get(l.leaveType), h ? this.handovers.buildView(h, dir, tasks, todayStr) : undefined);
      })
      .sort((a, b) => b.appliedDate.localeCompare(a.appliedDate) || b.leaveId.localeCompare(a.leaveId));
  }

  async getDetails(actor: Actor, id: string): Promise<LeaveDetails> {
    const leave = await this.requireLeave(id);
    const dir = await loadDirectory(this.deps);
    const handover = await this.deps.repos.handovers.findByLeave(id);
    const isOwner = leave.employeeId === actor.employeeId;
    const isApprover = access.isAdmin(actor) || access.isManagerOf(actor, dir.get(leave.employeeId)) || leave.approverId === actor.employeeId;
    const isBackup = handover?.backupEmployeeId === actor.employeeId;
    if (!isOwner && !isApprover && !isBackup) throw forbidden();

    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const type = await this.deps.repos.leaveTypes.findById(leave.leaveType);
    const hView = await this.handovers.viewForLeave(id, dir, todayStr);
    const history = [
      ...(await this.deps.repos.approvals.findForEntity('LEAVE', id)),
      ...(handover ? await this.deps.repos.approvals.findForEntity('HANDOVER', handover.handoverId) : []),
    ]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => ({ ...a, actor: dir.summary(a.actorId) }));
    const insights = isApprover || isOwner ? await this.insights(leave, dir) : { warnings: [], overlappingTeamLeaves: [] };
    return { ...this.toView(leave, dir, type ?? undefined, hView), history, insights };
  }

  /** Approval warnings shown to managers before deciding. */
  async insights(leave: LeaveRequest, dir?: Directory): Promise<LeaveInsights> {
    dir ??= await loadDirectory(this.deps);
    const settings = await this.settings.get();
    const todayStr = today(this.deps, settings);
    const warnings: InsightWarning[] = [];
    const employee = dir.get(leave.employeeId);
    const team = dir.active().filter((e) => e.managerId === employee?.managerId || e.department === employee?.department);
    const teamIds = team.map((e) => e.employeeId).filter((id) => id !== leave.employeeId);
    const types = new Map((await this.deps.repos.leaveTypes.findAll()).map((t) => [t.code, t]));

    const overlapping = await this.deps.repos.leaves.findOverlapping(teamIds, leave.startDate, leave.endDate, ['APPROVED', 'PENDING']);
    if (overlapping.length) {
      // peak number of people away on a single day
      let peak = 0;
      for (const day of eachDay(leave.startDate, leave.endDate)) {
        const away = new Set(overlapping.filter((o) => o.startDate <= day && o.endDate >= day).map((o) => o.employeeId)).size;
        peak = Math.max(peak, away);
      }
      const pct = Math.round(((peak + 1) / Math.max(team.length, 1)) * 100);
      warnings.push({
        code: 'TEAM_OVERLAP',
        severity: pct >= settings.teamOverlapWarningPercent ? 'warning' : 'info',
        message: `${overlapping.length} other team leave(s) overlap this period — up to ${peak + 1} of ${team.length} people (${pct}%) away on the same day`,
      });
    }

    const handover = await this.deps.repos.handovers.findByLeave(leave.leaveId);
    if (!handover) {
      warnings.push({ code: 'NO_HANDOVER', severity: settings.requireHandover ? 'error' : 'warning', message: 'No work handover has been created for this leave' });
    } else {
      const backup = dir.get(handover.backupEmployeeId);
      if (handover.handoverStatus === 'PENDING_ACCEPTANCE') {
        warnings.push({ code: 'HANDOVER_NOT_ACCEPTED', severity: 'warning', message: `${backup?.employeeName ?? 'The backup'} has not accepted the handover yet` });
      } else if (handover.handoverStatus === 'DECLINED') {
        warnings.push({ code: 'HANDOVER_DECLINED', severity: 'error', message: `${backup?.employeeName ?? 'The backup'} declined the handover: ${handover.declineReason}` });
      }
      if (!backup || backup.employmentStatus === 'INACTIVE') {
        warnings.push({ code: 'BACKUP_INACTIVE', severity: 'error', message: 'The selected backup employee is no longer active' });
      } else {
        const backupLeaves = await this.deps.repos.leaves.findOverlapping([backup.employeeId], leave.startDate, leave.endDate, ['APPROVED', 'PENDING']);
        if (backupLeaves.length) {
          warnings.push({ code: 'BACKUP_UNAVAILABLE', severity: 'error', message: `${backup.employeeName} has leave overlapping this period (${backupLeaves.map((l) => `${l.startDate} → ${l.endDate}`).join(', ')})` });
        }
        const open = (await this.deps.repos.handovers.findByBackup(backup.employeeId)).filter(
          (h) => h.handoverId !== handover.handoverId && ['PENDING_ACCEPTANCE', 'ACCEPTED', 'ACTIVE'].includes(h.handoverStatus) && rangesOverlap(h.startDate, h.endDate, leave.startDate, leave.endDate),
        );
        if (open.length >= settings.backupOverloadThreshold) {
          warnings.push({ code: 'BACKUP_OVERLOADED', severity: 'warning', message: `${backup.employeeName} is covering ${open.length} other handover(s) in this period` });
        }
      }
      const tasks = await this.deps.repos.tasks.findByHandover(handover.handoverId);
      const criticalNoOwner = tasks.filter((t) => t.priority === 'CRITICAL' && !t.assignedEmployeeId);
      if (handover.priority === 'CRITICAL' && tasks.length === 0) {
        warnings.push({ code: 'CRITICAL_NO_TASKS', severity: 'warning', message: 'Critical handover has no tasks defined' });
      }
      if (criticalNoOwner.length) {
        warnings.push({ code: 'CRITICAL_NO_OWNER', severity: 'error', message: `${criticalNoOwner.length} critical task(s) have no backup owner` });
      }
    }

    let balance;
    const type = types.get(leave.leaveType);
    if (type?.trackBalance) {
      balance = await this.balances.getBalance(leave.employeeId, leave.leaveType, await this.balances.yearFor(leave.startDate));
      if (balance && balance.available < 0) {
        warnings.push({ code: 'NEGATIVE_BALANCE', severity: 'error', message: `Employee balance is negative (${balance.available})` });
      }
    }
    if (leave.status === 'PENDING' && leave.startDate <= todayStr) {
      warnings.push({ code: 'STARTED', severity: 'info', message: 'This leave has already started' });
    }
    const typeMap = types;
    return {
      warnings,
      overlappingTeamLeaves: overlapping.map((l) => this.toView(l, dir!, typeMap.get(l.leaveType))),
      balance,
    };
  }

  /** Leave events for calendars (no reasons exposed to colleagues). */
  async calendar(actor: Actor, filters: CalendarFilters): Promise<CalendarLeaveEvent[]> {
    const dir = await loadDirectory(this.deps);
    const visible = access.teamIds(actor, dir);
    const types = new Map((await this.deps.repos.leaveTypes.findAll()).map((t) => [t.code, t]));
    const statuses = filters.includePending === false ? ['APPROVED'] : ['APPROVED', 'PENDING', 'CHANGES_REQUESTED'];
    const leaves = await this.deps.repos.leaves.findOverlapping(null, filters.from, filters.to, statuses);
    return leaves
      .filter((l) => !visible || visible.has(l.employeeId))
      .filter((l) => !filters.department || dir.get(l.employeeId)?.department === filters.department)
      .filter((l) => !filters.leaveType || l.leaveType === filters.leaveType)
      .filter((l) => !filters.employeeId || l.employeeId === filters.employeeId)
      .map((l) => toCalendarEvent(l, dir, types.get(l.leaveType)));
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  toView(l: LeaveRequest, dir: Directory, type: LeaveType | undefined, handover?: LeaveRequestView['handover']): LeaveRequestView {
    return {
      ...l,
      employee: dir.summary(l.employeeId),
      approver: dir.summary(l.approverId),
      leaveTypeName: type?.name ?? l.leaveType,
      leaveTypeColor: type?.color ?? '#64748B',
      handover,
    };
  }

  private async requireLeave(id: string): Promise<LeaveRequest> {
    const leave = await this.deps.repos.leaves.findById(id);
    if (!leave) throw notFound('Leave request', id);
    return leave;
  }

  private assertTransition(leave: LeaveRequest, to: LeaveStatus) {
    if (!canTransitionLeave(leave.status, to)) {
      throw validationError(`Cannot change a ${LEAVE_STATUS_LABELS[leave.status].toLowerCase()} leave to ${LEAVE_STATUS_LABELS[to].toLowerCase()}`);
    }
  }

  private async assertCanDecide(actor: Actor, leave: LeaveRequest) {
    const settings = await this.settings.get();
    if (leave.employeeId === actor.employeeId && !(access.isAdmin(actor) && settings.allowSelfApprovalForAdmins)) {
      throw forbidden('You cannot approve your own leave');
    }
    if (access.isAdmin(actor) || leave.approverId === actor.employeeId) return;
    const employee = await this.deps.repos.employees.findById(leave.employeeId);
    if (!access.isManagerOf(actor, employee ?? undefined)) throw forbidden('Only the reporting manager or HR can decide on this leave');
  }

  private async resolveApprover(employee: Employee): Promise<string> {
    if (employee.managerId) {
      const manager = await this.deps.repos.employees.findById(employee.managerId);
      if (manager && manager.employmentStatus !== 'INACTIVE') return manager.employeeId;
    }
    const dir = await loadDirectory(this.deps);
    const admin = dir.admins().find((a) => a.employeeId !== employee.employeeId) ?? dir.admins()[0];
    if (!admin) throw validationError('No approver is configured for you. Ask HR to assign a manager.');
    return admin.employeeId;
  }

  private async record(leaveId: string, action: ApprovalAction, actorId: string, comment: string) {
    await this.deps.repos.approvals.create({ entityType: 'LEAVE', entityId: leaveId, action, actorId, comment, createdAt: nowIso(this.deps) });
  }
}

export function toCalendarEvent(l: LeaveRequest, dir: Directory, type: LeaveType | undefined): CalendarLeaveEvent {
  const e = dir.get(l.employeeId);
  return {
    leaveId: l.leaveId,
    employeeId: l.employeeId,
    employeeName: e?.employeeName ?? l.employeeId,
    department: e?.department ?? '',
    leaveType: l.leaveType,
    leaveTypeName: type?.name ?? l.leaveType,
    color: type?.color ?? '#64748B',
    startDate: l.startDate,
    endDate: l.endDate,
    totalDays: l.totalDays,
    halfDay: l.halfDay,
    status: l.status,
  };
}
