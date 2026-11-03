import { describe, expect, it } from 'vitest';
import {
  balanceAvailable,
  balanceTotal,
  canTransitionHandover,
  canTransitionLeave,
  carryForwardAmount,
  completionPercent,
  isTaskOverdue,
  resolveHandoverStatus,
} from '../policy';
import { leaveApplicationSchema, taskUpdateSchema } from '../schemas';

describe('balances', () => {
  const b = { allocated: 12, carriedForward: 3, adjusted: 1, used: 4, pending: 2.5 };
  it('computes total and available', () => {
    expect(balanceTotal(b)).toBe(16);
    expect(balanceAvailable(b)).toBe(9.5);
  });
  it('caps carry forward by policy', () => {
    expect(carryForwardAmount(8, true, 5)).toBe(5);
    expect(carryForwardAmount(3, true, 5)).toBe(3);
    expect(carryForwardAmount(8, false, 5)).toBe(0);
    expect(carryForwardAmount(-1, true, 5)).toBe(0);
    expect(carryForwardAmount(40, true, 0)).toBe(40);
  });
});

describe('workflow state machines', () => {
  it('allows only valid leave transitions', () => {
    expect(canTransitionLeave('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionLeave('CHANGES_REQUESTED', 'PENDING')).toBe(true);
    expect(canTransitionLeave('APPROVED', 'REJECTED')).toBe(false);
    expect(canTransitionLeave('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransitionLeave('CANCELLED', 'PENDING')).toBe(false);
  });
  it('allows only valid handover transitions', () => {
    expect(canTransitionHandover('PENDING_ACCEPTANCE', 'ACCEPTED')).toBe(true);
    expect(canTransitionHandover('ACTIVE', 'COMPLETED')).toBe(true);
    expect(canTransitionHandover('COMPLETED', 'ACTIVE')).toBe(false);
    expect(canTransitionHandover('DECLINED', 'ACCEPTED')).toBe(false);
  });
  it('activates a handover only when accepted AND the leave is approved', () => {
    expect(resolveHandoverStatus('ACCEPTED', 'APPROVED')).toBe('ACTIVE');
    expect(resolveHandoverStatus('ACCEPTED', 'PENDING')).toBe('ACCEPTED');
    expect(resolveHandoverStatus('PENDING_ACCEPTANCE', 'APPROVED')).toBe('PENDING_ACCEPTANCE');
    expect(resolveHandoverStatus('ACTIVE', 'CANCELLED')).toBe('CANCELLED');
    expect(resolveHandoverStatus('COMPLETED', 'CANCELLED')).toBe('COMPLETED');
  });
});

describe('tasks', () => {
  it('computes completion and overdue state', () => {
    expect(completionPercent([])).toBe(0);
    expect(completionPercent([{ taskStatus: 'COMPLETED' }, { taskStatus: 'IN_PROGRESS' }, { taskStatus: 'BLOCKED' }])).toBe(33);
    expect(isTaskOverdue({ dueDate: '2026-11-01', taskStatus: 'IN_PROGRESS' }, '2026-11-03')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-11-01', taskStatus: 'COMPLETED' }, '2026-11-03')).toBe(false);
    expect(isTaskOverdue({ dueDate: '', taskStatus: 'NOT_STARTED' }, '2026-11-03')).toBe(false);
  });
  it('task updates never blank out omitted comments', () => {
    expect(taskUpdateSchema.parse({ taskStatus: 'COMPLETED' }).comments).toBeUndefined();
  });
});

describe('leave application schema', () => {
  const valid = { leaveType: 'CL', startDate: '2026-11-10', endDate: '2026-11-11', reason: 'Family function' };
  it('accepts a valid request and applies defaults', () => {
    const parsed = leaveApplicationSchema.parse(valid);
    expect(parsed.halfDay).toBe('NONE');
  });
  it('rejects reversed dates and multi-day half days', () => {
    expect(leaveApplicationSchema.safeParse({ ...valid, endDate: '2026-11-01' }).success).toBe(false);
    expect(leaveApplicationSchema.safeParse({ ...valid, halfDay: 'FIRST_HALF' }).success).toBe(false);
  });
  it('requires a handover period that ends after it starts', () => {
    const r = leaveApplicationSchema.safeParse({
      ...valid,
      handover: { backupEmployeeId: 'EMP002', handoverTitle: 'Cover', handoverDescription: 'Cover my work please', startDate: '2026-11-12', endDate: '2026-11-10', tasks: [] },
    });
    expect(r.success).toBe(false);
  });
});
