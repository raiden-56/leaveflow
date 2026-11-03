import {
  ACTIVE_LEAVE_STATUSES,
  HANDOVER_STATUS_LABELS,
  OPEN_HANDOVER_STATUSES,
  canTransitionHandover,
  completionPercent,
  isTaskOverdue,
  rangesOverlap,
  resolveHandoverStatus,
  type BackupCandidate,
  type Employee,
  type HandoverInput,
  type HandoverStatus,
  type HandoverTask,
  type HandoverTaskInput,
  type HandoverTaskView,
  type LeaveRequest,
  type Priority,
  type TaskStatus,
  type TaskUpdateInput,
  type WorkHandover,
  type WorkHandoverView,
} from '@leaveflow/shared';
import { assertNoErrors, forbidden, notFound, validationError } from '../utils/errors.js';
import { Directory, access, loadDirectory, nowIso, today, toSummary, type Actor, type ServiceDeps } from './context.js';
import type { AuditService } from './auditService.js';
import type { NotificationService } from './notifications/notificationService.js';
import type { SettingsService } from './settingsService.js';

export interface HandoverFilters {
  scope?: 'created' | 'assigned' | 'team' | 'all';
  status?: HandoverStatus;
  priority?: Priority;
  employeeId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface TaskFilters {
  scope?: 'mine' | 'team' | 'all';
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  overdue?: boolean;
  search?: string;
}

export interface AssignmentCheck {
  errors: string[];
  warnings: string[];
}

export class HandoverService {
  constructor(
    private readonly deps: ServiceDeps,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  private async today(): Promise<string> {
    return today(this.deps, await this.settings.get());
  }

  // ---------------------------------------------------------------------------
  // Read models
  // ---------------------------------------------------------------------------

  taskView(t: HandoverTask, dir: Directory, todayStr: string): HandoverTaskView {
    return { ...t, assignee: dir.summary(t.assignedEmployeeId), isOverdue: isTaskOverdue(t, todayStr) };
  }

  buildView(h: WorkHandover, dir: Directory, tasks: HandoverTask[], todayStr: string, leave?: LeaveRequest | null): WorkHandoverView {
    return {
      ...h,
      employee: dir.summary(h.employeeId),
      backupEmployee: dir.summary(h.backupEmployeeId),
      tasks: tasks
        .filter((t) => t.handoverId === h.handoverId)
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        .map((t) => this.taskView(t, dir, todayStr)),
      leaveStatus: leave?.status,
      leaveType: leave?.leaveType,
    };
  }

  canView(actor: Actor, h: WorkHandover, dir: Directory): boolean {
    if (access.isAdmin(actor)) return true;
    if (h.employeeId === actor.employeeId || h.backupEmployeeId === actor.employeeId) return true;
    if (access.isManagerOf(actor, dir.get(h.employeeId))) return true;
    return false;
  }

  async list(actor: Actor, filters: HandoverFilters = {}): Promise<WorkHandoverView[]> {
    const [dir, handovers, tasks, leaves, todayStr] = await Promise.all([
      loadDirectory(this.deps),
      this.deps.repos.handovers.findAll(),
      this.deps.repos.tasks.findAll(),
      this.deps.repos.leaves.findAll(),
      this.today(),
    ]);
    const leaveMap = new Map(leaves.map((l) => [l.leaveId, l]));
    const managed = access.managedIds(actor, dir);
    const scope = filters.scope ?? 'all';
    const q = filters.search?.trim().toLowerCase();

    return handovers
      .filter((h) => {
        if (scope === 'created') return h.employeeId === actor.employeeId;
        if (scope === 'assigned') return h.backupEmployeeId === actor.employeeId;
        if (scope === 'team') return managed === null || managed.has(h.employeeId);
        return this.canView(actor, h, dir);
      })
      .filter((h) => !filters.status || h.handoverStatus === filters.status)
      .filter((h) => !filters.priority || h.priority === filters.priority)
      .filter((h) => !filters.employeeId || h.employeeId === filters.employeeId || h.backupEmployeeId === filters.employeeId)
      .filter((h) => !filters.from || h.endDate >= filters.from)
      .filter((h) => !filters.to || h.startDate <= filters.to)
      .filter(
        (h) =>
          !q ||
          [h.handoverId, h.handoverTitle, h.handoverDescription, dir.name(h.employeeId), dir.name(h.backupEmployeeId)].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .map((h) => this.buildView(h, dir, tasks, todayStr, leaveMap.get(h.leaveId)))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async get(actor: Actor, id: string): Promise<WorkHandoverView> {
    const dir = await loadDirectory(this.deps);
    const h = await this.deps.repos.handovers.findById(id);
    if (!h) throw notFound('Handover', id);
    if (!this.canView(actor, h, dir)) throw forbidden();
    const [tasks, leave, todayStr] = await Promise.all([
      this.deps.repos.tasks.findByHandover(id),
      this.deps.repos.leaves.findById(h.leaveId),
      this.today(),
    ]);
    return this.buildView(h, dir, tasks, todayStr, leave);
  }

  async viewForLeave(leaveId: string, dir: Directory, todayStr: string): Promise<WorkHandoverView | undefined> {
    const h = await this.deps.repos.handovers.findByLeave(leaveId);
    if (!h) return undefined;
    const tasks = await this.deps.repos.tasks.findByHandover(h.handoverId);
    return this.buildView(h, dir, tasks, todayStr);
  }

  // ---------------------------------------------------------------------------
  // Backup selection & validation
  // ---------------------------------------------------------------------------

  async backupCandidates(actor: Actor, startDate: string, endDate: string, excludeLeaveId?: string): Promise<BackupCandidate[]> {
    const [dir, settings, handovers, tasks] = await Promise.all([
      loadDirectory(this.deps),
      this.settings.get(),
      this.deps.repos.handovers.findAll(),
      this.deps.repos.tasks.findAll(),
    ]);
    const leaves = await this.deps.repos.leaves.findOverlapping(null, startDate, endDate, ACTIVE_LEAVE_STATUSES);
    return dir
      .active()
      .filter((e) => e.employeeId !== actor.employeeId)
      .map((e) => {
        const own = leaves.filter((l) => l.employeeId === e.employeeId && l.leaveId !== excludeLeaveId);
        const approved = own.filter((l) => l.status === 'APPROVED');
        const coversWholeRange = approved.some((l) => l.startDate <= startDate && l.endDate >= endDate);
        const open = handovers.filter((h) => h.backupEmployeeId === e.employeeId && OPEN_HANDOVER_STATUSES.includes(h.handoverStatus));
        const overlapping = open.filter((h) => h.leaveId !== excludeLeaveId && rangesOverlap(h.startDate, h.endDate, startDate, endDate));
        const openTasks = tasks.filter((t) => t.assignedEmployeeId === e.employeeId && t.taskStatus !== 'COMPLETED' && open.some((h) => h.handoverId === t.handoverId));
        const availability: BackupCandidate['availability'] = coversWholeRange ? 'ON_LEAVE' : own.length ? 'PARTIALLY_AVAILABLE' : 'AVAILABLE';
        const note = own.length
          ? own.map((l) => `${l.status === 'APPROVED' ? 'On leave' : 'Leave pending'} ${l.startDate} → ${l.endDate}`).join('; ')
          : 'Available for the whole period';
        return {
          ...toSummary(e)!,
          availability,
          availabilityNote: note,
          openHandovers: open.length,
          openTasks: openTasks.length,
          overlappingHandovers: overlapping.length,
          isOverloaded: overlapping.length >= settings.backupOverloadThreshold,
        };
      })
      .sort((a, b) => {
        const rank = { AVAILABLE: 0, PARTIALLY_AVAILABLE: 1, ON_LEAVE: 2 } as const;
        const sameDeptA = a.department === actor.department ? 0 : 1;
        const sameDeptB = b.department === actor.department ? 0 : 1;
        return rank[a.availability] - rank[b.availability] || sameDeptA - sameDeptB || a.openHandovers - b.openHandovers || a.employeeName.localeCompare(b.employeeName);
      });
  }

  /** Validates a handover assignment for a leave period. Errors block submission, warnings are informational. */
  async checkAssignment(employee: Employee, input: HandoverInput, leave: { startDate: string; endDate: string }, excludeLeaveId?: string): Promise<AssignmentCheck> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const settings = await this.settings.get();
    const backup = await this.deps.repos.employees.findById(input.backupEmployeeId);

    if (input.backupEmployeeId === employee.employeeId) errors.push('You cannot assign the handover to yourself');
    if (!backup) errors.push(`Backup employee ${input.backupEmployeeId} does not exist`);
    else if (backup.employmentStatus === 'INACTIVE') errors.push(`${backup.employeeName} is no longer active`);
    if (input.startDate > leave.startDate || input.endDate < leave.endDate) {
      errors.push('The handover period must cover the entire leave period');
    }

    if (backup && backup.employmentStatus !== 'INACTIVE') {
      const backupLeaves = (await this.deps.repos.leaves.findOverlapping([backup.employeeId], leave.startDate, leave.endDate, ACTIVE_LEAVE_STATUSES)).filter(
        (l) => l.leaveId !== excludeLeaveId,
      );
      const approved = backupLeaves.filter((l) => l.status === 'APPROVED');
      if (approved.length) {
        errors.push(`${backup.employeeName} is on approved leave (${approved[0].startDate} → ${approved[0].endDate}) during your leave`);
      } else if (backupLeaves.length) {
        warnings.push(`${backup.employeeName} has a pending leave request overlapping your leave`);
      }
      const open = (await this.deps.repos.handovers.findByBackup(backup.employeeId)).filter(
        (h) => h.leaveId !== excludeLeaveId && OPEN_HANDOVER_STATUSES.includes(h.handoverStatus) && rangesOverlap(h.startDate, h.endDate, input.startDate, input.endDate),
      );
      if (open.length >= settings.backupOverloadThreshold) {
        warnings.push(`${backup.employeeName} already covers ${open.length} other handover(s) in this period and may be overloaded`);
      } else if (open.length) {
        warnings.push(`${backup.employeeName} is also covering ${open.length} other handover(s) in this period`);
      }
    }

    const assigneeIds = [...new Set(input.tasks.map((t) => t.assignedEmployeeId).filter(Boolean))];
    for (const id of assigneeIds) {
      if (id === employee.employeeId) errors.push('Tasks cannot be assigned to yourself while you are on leave');
      const assignee = await this.deps.repos.employees.findById(id);
      if (!assignee || assignee.employmentStatus === 'INACTIVE') errors.push(`Task assignee ${id} is not an active employee`);
    }
    const critical = input.tasks.filter((t) => t.priority === 'CRITICAL');
    if (input.priority === 'CRITICAL' && input.tasks.length === 0) warnings.push('Critical handover has no tasks listed');
    if (critical.some((t) => !t.dueDate)) warnings.push('Some critical tasks have no due date');
    return { errors: [...new Set(errors)], warnings };
  }

  // ---------------------------------------------------------------------------
  // Mutations used by the leave workflow (always run inside the caller's unit of work)
  // ---------------------------------------------------------------------------

  async createForLeave(leave: LeaveRequest, employee: Employee, input: HandoverInput, actor: Actor): Promise<WorkHandover> {
    const handover = await this.deps.repos.handovers.create({
      leaveId: leave.leaveId,
      employeeId: employee.employeeId,
      backupEmployeeId: input.backupEmployeeId,
      handoverTitle: input.handoverTitle,
      handoverDescription: input.handoverDescription,
      startDate: input.startDate,
      endDate: input.endDate,
      priority: input.priority,
      instructions: input.instructions,
      handoverStatus: 'PENDING_ACCEPTANCE',
      acceptedDate: '',
      declineReason: '',
      completionStatus: 0,
      createdAt: nowIso(this.deps),
      completedDate: '',
    });
    await this.syncTasks(handover, input.tasks);
    await this.record(handover.handoverId, 'SUBMITTED', actor.employeeId, '');
    await this.notifyAssigned(handover, employee);
    return handover;
  }

  /** Applies edits from a resubmitted leave. Changing the backup restarts acceptance. */
  async updateForLeave(existing: WorkHandover, employee: Employee, input: HandoverInput, actor: Actor): Promise<WorkHandover> {
    const backupChanged = existing.backupEmployeeId !== input.backupEmployeeId;
    const needsReacceptance = backupChanged || existing.handoverStatus === 'DECLINED' || existing.handoverStatus === 'CANCELLED';
    const updated = await this.deps.repos.handovers.update(existing.handoverId, {
      backupEmployeeId: input.backupEmployeeId,
      handoverTitle: input.handoverTitle,
      handoverDescription: input.handoverDescription,
      startDate: input.startDate,
      endDate: input.endDate,
      priority: input.priority,
      instructions: input.instructions,
      ...(needsReacceptance ? { handoverStatus: 'PENDING_ACCEPTANCE' as const, acceptedDate: '', declineReason: '' } : {}),
    });
    await this.syncTasks(updated, input.tasks);
    if (needsReacceptance) {
      await this.record(existing.handoverId, 'RESUBMITTED', actor.employeeId, backupChanged ? `Backup changed to ${input.backupEmployeeId}` : '');
      await this.notifyAssigned(updated, employee);
    }
    return updated;
  }

  private async syncTasks(handover: WorkHandover, inputs: HandoverTaskInput[]): Promise<void> {
    const existing = await this.deps.repos.tasks.findByHandover(handover.handoverId);
    const keep = new Set(inputs.map((t) => t.taskId).filter(Boolean));
    for (const t of existing) if (!keep.has(t.taskId)) await this.deps.repos.tasks.delete(t.taskId);
    const now = nowIso(this.deps);
    for (const input of inputs) {
      const fields = {
        taskTitle: input.taskTitle,
        taskDescription: input.taskDescription,
        priority: input.priority,
        dueDate: input.dueDate,
        assignedEmployeeId: input.assignedEmployeeId || handover.backupEmployeeId,
        referenceLinks: input.referenceLinks,
        expectedOutcome: input.expectedOutcome,
        notes: input.notes,
        updatedAt: now,
      };
      const match = input.taskId ? existing.find((t) => t.taskId === input.taskId) : undefined;
      if (match) await this.deps.repos.tasks.update(match.taskId, fields);
      else await this.deps.repos.tasks.create({ ...fields, handoverId: handover.handoverId, taskStatus: 'NOT_STARTED', comments: '', createdAt: now });
    }
    await this.recomputeCompletion(handover.handoverId);
  }

  /** Keeps the handover in step with the leave decision (activate / cancel). */
  async syncWithLeave(leave: LeaveRequest, actor: Actor | null): Promise<WorkHandover | null> {
    const h = await this.deps.repos.handovers.findByLeave(leave.leaveId);
    if (!h) return null;
    const next = resolveHandoverStatus(h.handoverStatus, leave.status);
    if (next === h.handoverStatus) return h;
    const updated = await this.deps.repos.handovers.update(h.handoverId, { handoverStatus: next });
    await this.record(h.handoverId, next === 'ACTIVE' ? 'ACTIVATED' : 'CANCELLED', actor?.employeeId ?? 'SYSTEM', `Leave ${leave.status.toLowerCase()}`);
    if (next === 'ACTIVE') {
      await this.notifications.notify({
        recipientIds: [h.backupEmployeeId],
        type: 'HANDOVER_ACCEPTED',
        title: 'Handover is now active',
        message: `The leave has been approved. You are covering "${h.handoverTitle}" from ${h.startDate} to ${h.endDate}.`,
        entityType: 'Handover',
        entityId: h.handoverId,
        link: `/handovers?id=${h.handoverId}`,
      });
    } else if (next === 'CANCELLED') {
      await this.notifications.notify({
        recipientIds: [h.backupEmployeeId],
        type: 'GENERAL',
        title: 'Handover cancelled',
        message: `"${h.handoverTitle}" is no longer needed because the leave was ${leave.status.toLowerCase().replace('_', ' ')}.`,
        entityType: 'Handover',
        entityId: h.handoverId,
        link: `/handovers?id=${h.handoverId}`,
        excludeActorId: actor?.employeeId,
      });
    }
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Handover actions
  // ---------------------------------------------------------------------------

  async createStandalone(actor: Actor, leaveId: string, input: HandoverInput): Promise<WorkHandoverView> {
    await this.deps.uow.run(async () => {
      const leave = await this.deps.repos.leaves.findById(leaveId);
      if (!leave) throw notFound('Leave', leaveId);
      if (leave.employeeId !== actor.employeeId) throw forbidden('Only the applicant can create a handover for this leave');
      if (!ACTIVE_LEAVE_STATUSES.includes(leave.status)) throw validationError('Handovers can only be added to active leave requests');
      if (await this.deps.repos.handovers.findByLeave(leaveId)) throw validationError('This leave already has a handover');
      const check = await this.checkAssignment(actor, input, leave, leaveId);
      assertNoErrors(check.errors);
      const h = await this.createForLeave(leave, actor, input, actor);
      await this.audit.log(actor, 'HANDOVER_CREATED', 'Handover', h.handoverId, { leaveId });
    });
    const h = (await this.deps.repos.handovers.findByLeave(leaveId))!;
    return this.get(actor, h.handoverId);
  }

  async update(actor: Actor, id: string, input: HandoverInput): Promise<WorkHandoverView> {
    await this.deps.uow.run(async () => {
      const h = await this.deps.repos.handovers.findById(id);
      if (!h) throw notFound('Handover', id);
      if (h.employeeId !== actor.employeeId) throw forbidden('Only the handover owner can edit it');
      if (!['PENDING_ACCEPTANCE', 'DECLINED', 'ACCEPTED', 'ACTIVE'].includes(h.handoverStatus)) {
        throw validationError(`A ${HANDOVER_STATUS_LABELS[h.handoverStatus].toLowerCase()} handover cannot be edited`);
      }
      if (h.handoverStatus === 'ACTIVE' && input.backupEmployeeId !== h.backupEmployeeId) {
        throw validationError('The backup of an active handover cannot be changed');
      }
      const leave = await this.deps.repos.leaves.findById(h.leaveId);
      if (!leave) throw notFound('Leave', h.leaveId);
      const check = await this.checkAssignment(actor, input, leave, leave.leaveId);
      assertNoErrors(check.errors);
      await this.updateForLeave(h, actor, input, actor);
      await this.audit.log(actor, 'HANDOVER_UPDATED', 'Handover', id);
    });
    return this.get(actor, id);
  }

  async accept(actor: Actor, id: string, comment = ''): Promise<WorkHandoverView> {
    await this.deps.uow.run(async () => {
      const h = await this.requireBackup(actor, id);
      this.assertTransition(h, 'ACCEPTED');
      const leave = await this.deps.repos.leaves.findById(h.leaveId);
      const next = leave ? resolveHandoverStatus('ACCEPTED', leave.status) : 'ACCEPTED';
      await this.deps.repos.handovers.update(id, { handoverStatus: next, acceptedDate: nowIso(this.deps), declineReason: '' });
      await this.record(id, 'ACCEPTED', actor.employeeId, comment);
      if (next === 'ACTIVE') await this.record(id, 'ACTIVATED', actor.employeeId, 'Leave already approved');
      const owner = await this.deps.repos.employees.findById(h.employeeId);
      await this.notifications.notify({
        recipientIds: [h.employeeId, owner?.managerId],
        type: 'HANDOVER_ACCEPTED',
        title: 'Handover accepted',
        message: `${actor.employeeName} accepted the handover "${h.handoverTitle}"${comment ? `: ${comment}` : '.'}`,
        entityType: 'Handover',
        entityId: id,
        link: `/handovers?id=${id}`,
        excludeActorId: actor.employeeId,
      });
      await this.audit.log(actor, 'HANDOVER_ACCEPTED', 'Handover', id);
    });
    return this.get(actor, id);
  }

  async decline(actor: Actor, id: string, reason: string): Promise<WorkHandoverView> {
    await this.deps.uow.run(async () => {
      const h = await this.requireBackup(actor, id);
      this.assertTransition(h, 'DECLINED');
      await this.deps.repos.handovers.update(id, { handoverStatus: 'DECLINED', declineReason: reason, acceptedDate: '' });
      await this.record(id, 'DECLINED', actor.employeeId, reason);
      const owner = await this.deps.repos.employees.findById(h.employeeId);
      await this.notifications.notify({
        recipientIds: [h.employeeId, owner?.managerId],
        type: 'HANDOVER_DECLINED',
        title: 'Handover declined',
        message: `${actor.employeeName} declined "${h.handoverTitle}": ${reason}. Please choose another backup.`,
        entityType: 'Handover',
        entityId: id,
        link: `/my-leaves?leave=${h.leaveId}`,
        excludeActorId: actor.employeeId,
      });
      await this.audit.log(actor, 'HANDOVER_DECLINED', 'Handover', id, { reason });
    });
    return this.get(actor, id);
  }

  async complete(actor: Actor, id: string, comment = ''): Promise<WorkHandoverView> {
    await this.deps.uow.run(async () => {
      const dir = await loadDirectory(this.deps);
      const h = await this.deps.repos.handovers.findById(id);
      if (!h) throw notFound('Handover', id);
      if (!this.canView(actor, h, dir)) throw forbidden();
      this.assertTransition(h, 'COMPLETED');
      await this.markCompleted(h, actor, comment);
    });
    return this.get(actor, id);
  }

  /** Used by the manual action and by the daily lifecycle job. */
  async markCompleted(h: WorkHandover, actor: Actor | null, comment = ''): Promise<void> {
    await this.deps.repos.handovers.update(h.handoverId, {
      handoverStatus: 'COMPLETED',
      completedDate: nowIso(this.deps),
    });
    await this.record(h.handoverId, 'COMPLETED', actor?.employeeId ?? 'SYSTEM', comment || 'Employee returned from leave');
    const owner = await this.deps.repos.employees.findById(h.employeeId);
    await this.notifications.notify({
      recipientIds: [h.employeeId, h.backupEmployeeId, owner?.managerId],
      type: 'HANDOVER_COMPLETED',
      title: 'Handover completed',
      message: `"${h.handoverTitle}" has been handed back to ${owner?.employeeName ?? h.employeeId}.`,
      entityType: 'Handover',
      entityId: h.handoverId,
      link: `/handovers?id=${h.handoverId}`,
      excludeActorId: actor?.employeeId,
    });
    await this.audit.log(actor, 'HANDOVER_COMPLETED', 'Handover', h.handoverId);
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async listTasks(actor: Actor, filters: TaskFilters = {}): Promise<(HandoverTaskView & { handover: Pick<WorkHandover, 'handoverId' | 'handoverTitle' | 'handoverStatus' | 'employeeId' | 'backupEmployeeId'> & { employeeName: string } })[]> {
    const [dir, handovers, tasks, todayStr] = await Promise.all([
      loadDirectory(this.deps),
      this.deps.repos.handovers.findAll(),
      this.deps.repos.tasks.findAll(),
      this.today(),
    ]);
    const hMap = new Map(handovers.map((h) => [h.handoverId, h]));
    const managed = access.managedIds(actor, dir);
    const scope = filters.scope ?? 'mine';
    const q = filters.search?.trim().toLowerCase();
    return tasks
      .filter((t) => {
        const h = hMap.get(t.handoverId);
        if (!h) return false;
        if (scope === 'mine') return t.assignedEmployeeId === actor.employeeId || h.employeeId === actor.employeeId;
        if (scope === 'team') return managed === null || managed.has(h.employeeId) || managed.has(t.assignedEmployeeId);
        return this.canView(actor, h, dir);
      })
      .filter((t) => !filters.status || t.taskStatus === filters.status)
      .filter((t) => !filters.priority || t.priority === filters.priority)
      .filter((t) => !filters.assigneeId || t.assignedEmployeeId === filters.assigneeId)
      .filter((t) => !filters.overdue || isTaskOverdue(t, todayStr))
      .filter((t) => !q || [t.taskId, t.taskTitle, t.taskDescription, dir.name(t.assignedEmployeeId)].some((v) => v.toLowerCase().includes(q)))
      .map((t) => {
        const h = hMap.get(t.handoverId)!;
        return {
          ...this.taskView(t, dir, todayStr),
          handover: {
            handoverId: h.handoverId,
            handoverTitle: h.handoverTitle,
            handoverStatus: h.handoverStatus,
            employeeId: h.employeeId,
            backupEmployeeId: h.backupEmployeeId,
            employeeName: dir.name(h.employeeId),
          },
        };
      })
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }

  async tasksForHandover(actor: Actor, handoverId: string): Promise<HandoverTaskView[]> {
    return (await this.get(actor, handoverId)).tasks;
  }

  async addTask(actor: Actor, handoverId: string, input: HandoverTaskInput): Promise<HandoverTaskView> {
    const task = await this.deps.uow.run(async () => {
      const h = await this.requireEditable(actor, handoverId);
      if (input.assignedEmployeeId) {
        const assignee = await this.deps.repos.employees.findById(input.assignedEmployeeId);
        if (!assignee || assignee.employmentStatus === 'INACTIVE') throw validationError('Assignee must be an active employee');
      }
      const now = nowIso(this.deps);
      const created = await this.deps.repos.tasks.create({
        ...input,
        handoverId,
        assignedEmployeeId: input.assignedEmployeeId || h.backupEmployeeId,
        taskStatus: 'NOT_STARTED',
        comments: '',
        createdAt: now,
        updatedAt: now,
      });
      await this.recomputeCompletion(handoverId);
      if (created.assignedEmployeeId !== actor.employeeId) {
        await this.notifications.notify({
          recipientIds: [created.assignedEmployeeId],
          type: 'HANDOVER_ASSIGNED',
          title: 'New handover task',
          message: `${actor.employeeName} added "${created.taskTitle}" to "${h.handoverTitle}".`,
          entityType: 'Handover',
          entityId: handoverId,
          link: `/handovers?id=${handoverId}`,
        });
      }
      await this.audit.log(actor, 'TASK_CREATED', 'HandoverTask', created.taskId);
      return created;
    });
    return this.taskView(task, await loadDirectory(this.deps), await this.today());
  }

  async updateTask(actor: Actor, taskId: string, input: TaskUpdateInput): Promise<HandoverTaskView> {
    const task = await this.deps.uow.run(async () => {
      const t = await this.deps.repos.tasks.findById(taskId);
      if (!t) throw notFound('Task', taskId);
      const h = await this.deps.repos.handovers.findById(t.handoverId);
      if (!h) throw notFound('Handover', t.handoverId);
      const dir = await loadDirectory(this.deps);
      const isOwner = h.employeeId === actor.employeeId;
      const isWorker = t.assignedEmployeeId === actor.employeeId || h.backupEmployeeId === actor.employeeId;
      const isManager = access.isAdmin(actor) || access.isManagerOf(actor, dir.get(h.employeeId));
      if (!isOwner && !isWorker && !isManager) throw forbidden();
      if (['COMPLETED', 'CANCELLED'].includes(h.handoverStatus) && !isManager) {
        throw validationError('Tasks of a closed handover cannot be changed');
      }
      const { taskId: _id, ...fields } = input;
      // Assignees may only update progress fields; content edits are for the owner/manager.
      const allowed: Partial<HandoverTask> = isOwner || isManager ? { ...fields } : { taskStatus: fields.taskStatus, comments: fields.comments };
      Object.keys(allowed).forEach((k) => allowed[k as keyof HandoverTask] === undefined && delete allowed[k as keyof HandoverTask]);
      const updated = await this.deps.repos.tasks.update(taskId, { ...allowed, updatedAt: nowIso(this.deps) });
      await this.recomputeCompletion(h.handoverId);
      if (fields.taskStatus && fields.taskStatus !== t.taskStatus) {
        await this.audit.log(actor, 'TASK_STATUS_CHANGED', 'HandoverTask', taskId, { from: t.taskStatus, to: fields.taskStatus });
      } else {
        await this.audit.log(actor, 'TASK_UPDATED', 'HandoverTask', taskId);
      }
      return updated;
    });
    return this.taskView(task, await loadDirectory(this.deps), await this.today());
  }

  async deleteTask(actor: Actor, taskId: string): Promise<void> {
    await this.deps.uow.run(async () => {
      const t = await this.deps.repos.tasks.findById(taskId);
      if (!t) throw notFound('Task', taskId);
      await this.requireEditable(actor, t.handoverId, true);
      await this.deps.repos.tasks.delete(taskId);
      await this.recomputeCompletion(t.handoverId);
      await this.audit.log(actor, 'TASK_DELETED', 'HandoverTask', taskId);
    });
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  async recomputeCompletion(handoverId: string): Promise<void> {
    const tasks = await this.deps.repos.tasks.findByHandover(handoverId);
    await this.deps.repos.handovers.update(handoverId, { completionStatus: completionPercent(tasks) });
  }

  private async requireBackup(actor: Actor, id: string): Promise<WorkHandover> {
    const h = await this.deps.repos.handovers.findById(id);
    if (!h) throw notFound('Handover', id);
    if (h.backupEmployeeId !== actor.employeeId) throw forbidden('Only the assigned backup employee can respond to this handover');
    return h;
  }

  private async requireEditable(actor: Actor, handoverId: string, ownerOrManagerOnly = false): Promise<WorkHandover> {
    const h = await this.deps.repos.handovers.findById(handoverId);
    if (!h) throw notFound('Handover', handoverId);
    const dir = await loadDirectory(this.deps);
    const isOwner = h.employeeId === actor.employeeId;
    const isManager = access.isAdmin(actor) || access.isManagerOf(actor, dir.get(h.employeeId));
    const isBackup = h.backupEmployeeId === actor.employeeId;
    if (!(isOwner || isManager || (!ownerOrManagerOnly && isBackup))) throw forbidden();
    if (['COMPLETED', 'CANCELLED'].includes(h.handoverStatus)) throw validationError('This handover is closed');
    return h;
  }

  private assertTransition(h: WorkHandover, to: HandoverStatus) {
    if (!canTransitionHandover(h.handoverStatus, to)) {
      throw validationError(`Cannot change a handover from ${HANDOVER_STATUS_LABELS[h.handoverStatus]} to ${HANDOVER_STATUS_LABELS[to]}`);
    }
  }

  private async record(handoverId: string, action: Parameters<ServiceDeps['repos']['approvals']['create']>[0]['action'], actorId: string, comment: string) {
    await this.deps.repos.approvals.create({ entityType: 'HANDOVER', entityId: handoverId, action, actorId, comment, createdAt: nowIso(this.deps) });
  }

  private async notifyAssigned(h: WorkHandover, employee: Employee) {
    await this.notifications.notify({
      recipientIds: [h.backupEmployeeId],
      type: 'HANDOVER_ASSIGNED',
      title: 'New work handover assigned',
      message: `${employee.employeeName} asked you to cover "${h.handoverTitle}" from ${h.startDate} to ${h.endDate}. Please accept or decline.`,
      entityType: 'Handover',
      entityId: h.handoverId,
      link: `/handovers?id=${h.handoverId}`,
    });
  }
}

