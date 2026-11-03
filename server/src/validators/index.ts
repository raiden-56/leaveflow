import { z } from 'zod';
import {
  HANDOVER_STATUSES,
  LEAVE_STATUSES,
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
  isoDate,
} from '@leaveflow/shared';

/** Query-string schemas. Request bodies reuse the shared schemas from @leaveflow/shared. */

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
const boolish = z.preprocess((v) => v === 'true' || v === true || v === '1', z.boolean());

export const paginationQuery = z.object({
  page: optional(z.coerce.number().int().min(1)),
  pageSize: optional(z.coerce.number().int().min(1).max(500)),
});

export const leaveListQuery = paginationQuery.extend({
  scope: optional(z.enum(['mine', 'team', 'all', 'approvals'])),
  status: optional(z.enum(LEAVE_STATUSES)),
  leaveType: optional(z.string().max(20)),
  department: optional(z.string().max(100)),
  employeeId: optional(z.string().max(20)),
  from: optional(isoDate),
  to: optional(isoDate),
  search: optional(z.string().max(100)),
});

export const calendarQuery = z.object({
  from: isoDate,
  to: isoDate,
  department: optional(z.string().max(100)),
  leaveType: optional(z.string().max(20)),
  employeeId: optional(z.string().max(20)),
  includePending: optional(boolish),
});

export const handoverListQuery = z.object({
  scope: optional(z.enum(['created', 'assigned', 'team', 'all'])),
  status: optional(z.enum(HANDOVER_STATUSES)),
  priority: optional(z.enum(PRIORITIES)),
  employeeId: optional(z.string().max(20)),
  from: optional(isoDate),
  to: optional(isoDate),
  search: optional(z.string().max(100)),
});

export const taskListQuery = z.object({
  scope: optional(z.enum(['mine', 'team', 'all'])),
  status: optional(z.enum(TASK_STATUSES)),
  priority: optional(z.enum(PRIORITIES)),
  assigneeId: optional(z.string().max(20)),
  overdue: optional(boolish),
  search: optional(z.string().max(100)),
});

export const candidateQuery = z.object({
  startDate: isoDate,
  endDate: isoDate,
  excludeLeaveId: optional(z.string().max(20)),
});

export const employeeListQuery = z.object({
  search: optional(z.string().max(100)),
  department: optional(z.string().max(100)),
  role: optional(z.enum(ROLES)),
  status: optional(z.string().max(20)),
  managerId: optional(z.string().max(20)),
  includeInactive: optional(boolish),
});

export const reportQuery = z.object({
  from: optional(isoDate),
  to: optional(isoDate),
  department: optional(z.string().max(100)),
  employeeId: optional(z.string().max(20)),
  leaveType: optional(z.string().max(20)),
});

export const reasonBody = z.object({ reason: z.string().trim().min(5, 'Please provide a reason (min 5 characters)').max(1000) });
export const optionalCommentBody = z.object({ comment: z.string().trim().max(1000).optional().default('') });
export const createHandoverBody = z.object({ leaveId: z.string().min(1) });

export function paginate<T>(items: T[], page?: number, pageSize?: number) {
  if (!page || !pageSize) return items;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}
