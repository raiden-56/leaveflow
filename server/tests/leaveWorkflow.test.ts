import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Employee, LeaveApplicationInput } from '@leaveflow/shared';
import { env } from '../src/config/env.js';
import { createContainer, type Container } from '../src/config/container.js';
import { WorkbookStore } from '../src/excel/workbookStore.js';

/**
 * Integration tests for the critical business rules, running against a real
 * (temporary) Excel workbook seeded with the demo data and a fixed clock.
 */

let dir: string;
let c: Container;
let now = new Date('2026-11-03T06:00:00Z'); // Tuesday
const employee = async (id: string) => (await c.repos.employees.findById(id)) as Employee;

const request = (overrides: Partial<LeaveApplicationInput> = {}, backup = 'EMP010'): LeaveApplicationInput => ({
  leaveType: 'CL',
  startDate: '2026-12-01',
  endDate: '2026-12-02',
  halfDay: 'NONE',
  reason: 'Family function',
  emergencyContact: '',
  contactDuringLeave: '',
  attachmentName: '',
  attachmentUrl: '',
  ...overrides,
  handover: {
    backupEmployeeId: backup,
    handoverTitle: 'API ownership',
    handoverDescription: 'Review PRs and watch production alerts',
    startDate: overrides.startDate ?? '2026-12-01',
    endDate: overrides.endDate ?? '2026-12-02',
    priority: 'HIGH',
    instructions: '',
    tasks: [
      { taskTitle: 'Review PR #500', taskDescription: '', priority: 'HIGH', dueDate: '2026-12-01', assignedEmployeeId: '', referenceLinks: '', expectedOutcome: '', notes: '' },
      { taskTitle: 'Watch alerts', taskDescription: '', priority: 'CRITICAL', dueDate: '2026-12-02', assignedEmployeeId: '', referenceLinks: '', expectedOutcome: '', notes: '' },
    ],
  },
});

async function expectError(promise: Promise<unknown>, pattern: RegExp, status?: number) {
  await expect(promise).rejects.toSatisfy((err: { message: string; status: number }) => {
    expect(err.message).toMatch(pattern);
    if (status) expect(err.status).toBe(status);
    return true;
  });
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaveflow-test-'));
  c = await createContainer({ ...env, workbookPath: path.join(dir, 'LeaveFlow.xlsx'), backupDir: path.join(dir, 'backups') }, { clock: () => now });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('leave application rules', () => {
  it('rejects overlapping leave requests', async () => {
    const priya = await employee('EMP005');
    const [pending] = await c.repos.leaves.findWhere((l) => l.employeeId === 'EMP005' && l.status === 'PENDING');
    await expectError(c.leaves.apply(priya, request({ startDate: pending.startDate, endDate: pending.startDate, leaveType: 'SL' })), /Overlaps with your pending leave/, 422);
  });

  it('rejects assigning the handover to yourself', async () => {
    await expectError(c.leaves.apply(await employee('EMP005'), request({}, 'EMP005')), /cannot assign the handover to yourself/i);
  });

  it('rejects a backup who is on approved leave', async () => {
    const [away] = await c.repos.leaves.findWhere((l) => l.employeeId === 'EMP012' && l.status === 'APPROVED' && l.startDate > '2026-11-03');
    await expectError(
      c.leaves.apply(await employee('EMP014'), request({ leaveType: 'SL', startDate: away.startDate, endDate: away.startDate }, 'EMP012')),
      /is on approved leave/,
    );
  });

  it('rejects requests exceeding the available balance', async () => {
    await expectError(c.leaves.apply(await employee('EMP005'), request({ leaveType: 'PL', startDate: '2026-12-01', endDate: '2026-12-10' })), /Insufficient Privilege Leave balance/);
  });

  it('rejects dates in the past and leave falling only on weekends', async () => {
    await expectError(c.leaves.apply(await employee('EMP005'), request({ startDate: '2026-10-01', endDate: '2026-10-01' })), /cannot start in the past/);
    await expectError(c.leaves.apply(await employee('EMP005'), request({ startDate: '2026-12-05', endDate: '2026-12-06' })), /weekends or holidays/);
  });

  it('requires a work handover', async () => {
    const { handover: _h, ...noHandover } = request();
    await expectError(c.leaves.apply(await employee('EMP005'), noHandover), /work handover is required/);
  });
});

describe('leave + handover workflow', () => {
  let leaveId = '';
  let handoverId = '';

  it('submits leave, reserves balance and notifies approver and backup', async () => {
    const before = await c.balances.getBalance('EMP005', 'CL', 2026);
    const leave = await c.leaves.apply(await employee('EMP005'), request());
    leaveId = leave.leaveId;
    handoverId = leave.handover!.handoverId;
    expect(leave.status).toBe('PENDING');
    expect(leave.totalDays).toBe(2);
    expect(leave.approverId).toBe('EMP004');
    expect(leave.handover?.handoverStatus).toBe('PENDING_ACCEPTANCE');
    expect(leave.handover?.tasks.map((t) => t.assignedEmployeeId)).toEqual(['EMP010', 'EMP010']);
    const after = await c.balances.getBalance('EMP005', 'CL', 2026);
    expect(after!.pending).toBe(before!.pending + 2);
    const notes = await c.repos.notifications.findWhere((n) => n.entityId === leaveId || n.entityId === handoverId);
    expect(notes.map((n) => `${n.recipientId}:${n.type}`)).toEqual(expect.arrayContaining(['EMP004:LEAVE_SUBMITTED', 'EMP010:HANDOVER_ASSIGNED']));
  });

  it('only the reporting manager or HR can approve', async () => {
    await expectError(c.leaves.approve(await employee('EMP005'), leaveId), /cannot approve your own leave/, 403);
    await expectError(c.leaves.approve(await employee('EMP011'), leaveId), /reporting manager or HR/, 403);
  });

  it('only the backup can accept the handover', async () => {
    await expectError(c.handovers.accept(await employee('EMP009'), handoverId), /Only the assigned backup/, 403);
    const h = await c.handovers.accept(await employee('EMP010'), handoverId, 'Happy to help');
    expect(h.handoverStatus).toBe('ACCEPTED');
  });

  it('activates the handover and moves balance to used on approval', async () => {
    const before = await c.balances.getBalance('EMP005', 'CL', 2026);
    const leave = await c.leaves.approve(await employee('EMP004'), leaveId, 'Enjoy');
    expect(leave.status).toBe('APPROVED');
    expect(leave.handover?.handoverStatus).toBe('ACTIVE');
    const after = await c.balances.getBalance('EMP005', 'CL', 2026);
    expect(after!.pending).toBe(before!.pending - 2);
    expect(after!.used).toBe(before!.used + 2);
    expect(leave.history.map((h) => h.action)).toEqual(expect.arrayContaining(['SUBMITTED', 'ACCEPTED', 'APPROVED', 'ACTIVATED']));
  });

  it('lets the assignee update task status but not task content', async () => {
    const [task] = await c.repos.tasks.findByHandover(handoverId);
    const updated = await c.handovers.updateTask(await employee('EMP010'), task.taskId, { taskStatus: 'COMPLETED', taskTitle: 'Hacked title' });
    expect(updated.taskStatus).toBe('COMPLETED');
    expect(updated.taskTitle).toBe('Review PR #500');
    expect((await c.repos.handovers.findById(handoverId))!.completionStatus).toBe(50);
  });

  it('auto-completes the handover after the employee returns', async () => {
    now = new Date('2026-12-04T06:00:00Z');
    const result = await c.lifecycle.run();
    expect(result.completed).toBeGreaterThanOrEqual(1);
    expect((await c.repos.handovers.findById(handoverId))!.handoverStatus).toBe('COMPLETED');
    const returned = await c.repos.notifications.findWhere((n) => n.type === 'EMPLOYEE_RETURNED' && n.entityId === handoverId);
    expect(returned.map((n) => n.recipientId)).toEqual(expect.arrayContaining(['EMP010', 'EMP004']));
    // idempotent
    const again = await c.lifecycle.run();
    expect(again.completed).toBe(0);
    now = new Date('2026-11-03T06:00:00Z');
  });
});

describe('rejection, change requests and cancellation', () => {
  it('rejecting releases the reserved balance and cancels the handover', async () => {
    const before = await c.balances.getBalance('EMP006', 'CL', 2026);
    const leave = await c.leaves.apply(await employee('EMP006'), request({ startDate: '2026-12-08', endDate: '2026-12-08' }, 'EMP007'));
    const rejected = await c.leaves.reject(await employee('EMP004'), leave.leaveId, 'Release freeze that day');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.handover?.handoverStatus).toBe('CANCELLED');
    expect((await c.balances.getBalance('EMP006', 'CL', 2026))!.pending).toBe(before!.pending);
  });

  it('supports request changes → edit & resubmit with a new backup', async () => {
    const leave = await c.leaves.apply(await employee('EMP009'), request({ startDate: '2026-12-09', endDate: '2026-12-09' }, 'EMP006'));
    const changed = await c.leaves.requestChanges(await employee('EMP004'), leave.leaveId, 'Please pick Sneha as backup');
    expect(changed.status).toBe('CHANGES_REQUESTED');
    const resubmitted = await c.leaves.update(await employee('EMP009'), leave.leaveId, request({ startDate: '2026-12-09', endDate: '2026-12-09' }, 'EMP007'));
    expect(resubmitted.status).toBe('PENDING');
    expect(resubmitted.handover?.backupEmployeeId).toBe('EMP007');
    expect(resubmitted.handover?.handoverStatus).toBe('PENDING_ACCEPTANCE');
  });

  it('cancelling an approved future leave returns the days', async () => {
    const leave = await c.leaves.apply(await employee('EMP010'), request({ startDate: '2026-12-15', endDate: '2026-12-15' }, 'EMP005'));
    await c.leaves.approve(await employee('EMP004'), leave.leaveId);
    const before = await c.balances.getBalance('EMP010', 'CL', 2026);
    const cancelled = await c.leaves.cancel(await employee('EMP010'), leave.leaveId, 'Plans changed');
    expect(cancelled.status).toBe('CANCELLED');
    expect((await c.balances.getBalance('EMP010', 'CL', 2026))!.used).toBe(before!.used - 1);
  });
});

describe('excel persistence', () => {
  it('persists every change to the workbook file', async () => {
    const fresh = new WorkbookStore({ filePath: path.join(dir, 'LeaveFlow.xlsx'), backupDir: path.join(dir, 'backups') });
    await fresh.init();
    const leaves = fresh.rows<{ leaveId: string; status: string }>('LeaveRequests');
    const inMemory = await c.repos.leaves.findAll();
    expect(leaves.length).toBe(inMemory.length);
    expect(leaves.find((l) => l.leaveId === inMemory.at(-1)!.leaveId)?.status).toBe(inMemory.at(-1)!.status);
  });

  it('serialises concurrent writes without duplicate IDs', async () => {
    const created = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        c.repos.notifications.create({ recipientId: 'EMP005', type: 'GENERAL', title: `Concurrent ${i}`, message: 'x', entityType: '', entityId: '', link: '', isRead: false, createdAt: now.toISOString(), readAt: '' }),
      ),
    );
    expect(new Set(created.map((n) => n.notificationId)).size).toBe(12);
  });

  it('rolls back a failed unit of work', async () => {
    const before = await c.repos.leaves.count();
    await expect(
      c.uow.run(async () => {
        await c.repos.leaves.create({ ...(await c.repos.leaves.findAll())[0], leaveId: '' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await c.repos.leaves.count()).toBe(before);
  });

  it('creates backups before modifying the workbook', () => {
    expect(fs.readdirSync(path.join(dir, 'backups')).length).toBeGreaterThan(0);
  });
});
