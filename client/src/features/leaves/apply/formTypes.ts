import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveApplicationSchema, type HalfDay, type Priority } from '@leaveflow/shared';

export interface TaskFormValues {
  taskId?: string;
  taskTitle: string;
  taskDescription: string;
  priority: Priority;
  dueDate: string;
  assignedEmployeeId: string;
  referenceLinks: string;
  expectedOutcome: string;
  notes: string;
}

export interface ApplyFormValues {
  leaveType: string;
  startDate: string;
  endDate: string;
  halfDay: HalfDay;
  reason: string;
  emergencyContact: string;
  contactDuringLeave: string;
  attachmentName: string;
  attachmentUrl: string;
  handover: {
    backupEmployeeId: string;
    handoverTitle: string;
    handoverDescription: string;
    startDate: string;
    endDate: string;
    priority: Priority;
    instructions: string;
    tasks: TaskFormValues[];
  };
}

export const emptyTask = (backupId = '', dueDate = ''): TaskFormValues => ({
  taskTitle: '',
  taskDescription: '',
  priority: 'MEDIUM',
  dueDate,
  assignedEmployeeId: backupId,
  referenceLinks: '',
  expectedOutcome: '',
  notes: '',
});

export const defaultValues: ApplyFormValues = {
  leaveType: '',
  startDate: '',
  endDate: '',
  halfDay: 'NONE',
  reason: '',
  emergencyContact: '',
  contactDuringLeave: '',
  attachmentName: '',
  attachmentUrl: '',
  handover: { backupEmployeeId: '', handoverTitle: '', handoverDescription: '', startDate: '', endDate: '', priority: 'MEDIUM', instructions: '', tasks: [] },
};

/** Builds the API payload; the handover is omitted when the user opted out (only possible when not mandatory). */
export function toPayload(values: ApplyFormValues, includeHandover: boolean) {
  const { handover, ...leave } = values;
  return includeHandover ? { ...leave, handover } : leave;
}

/**
 * Validates with the SAME shared Zod schema the API uses, so client and server
 * rules can never drift apart.
 */
export function applyResolver(includeHandover: () => boolean): Resolver<ApplyFormValues> {
  const base = zodResolver(leaveApplicationSchema) as unknown as Resolver<Record<string, unknown>>;
  return async (values, context, options) => {
    const result = await base(toPayload(values, includeHandover()) as Record<string, unknown>, context, options as never);
    return Object.keys(result.errors).length ? ({ values: {}, errors: result.errors } as never) : { values, errors: {} };
  };
}

export const STEP_FIELDS: (keyof ApplyFormValues | `handover.${string}`)[][] = [
  ['leaveType', 'startDate', 'endDate', 'halfDay', 'reason', 'emergencyContact', 'contactDuringLeave'],
  ['handover.backupEmployeeId', 'handover.handoverTitle', 'handover.handoverDescription', 'handover.startDate', 'handover.endDate', 'handover.priority', 'handover.instructions'],
  ['handover.tasks'],
  [],
];
