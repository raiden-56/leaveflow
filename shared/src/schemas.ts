import { z } from 'zod';
import { isIsoDate } from './dates';
import {
  EMPLOYMENT_STATUSES,
  HALF_DAY_OPTIONS,
  HOLIDAY_TYPES,
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
  WORK_MODES,
} from './types';

/**
 * Request validation schemas shared by the API (server-side validation) and
 * the UI (react-hook-form resolvers), so both sides enforce identical rules.
 */

export const isoDate = z.string().refine(isIsoDate, { message: 'Select a valid date' });
export const optionalIsoDate = z.union([isoDate, z.literal('')]).optional().default('');
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().default('');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const handoverTaskInputSchema = z.object({
  taskId: z.string().optional(),
  taskTitle: text(150).min(2, 'Task name is required'),
  taskDescription: optionalText(2000),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  dueDate: optionalIsoDate,
  assignedEmployeeId: optionalText(20),
  referenceLinks: optionalText(1000),
  expectedOutcome: optionalText(1000),
  notes: optionalText(1000),
});
export type HandoverTaskInput = z.infer<typeof handoverTaskInputSchema>;

export const handoverInputSchema = z
  .object({
    backupEmployeeId: text(20).min(1, 'Select a backup employee'),
    handoverTitle: text(150).min(3, 'Handover title is required'),
    handoverDescription: text(4000).min(10, 'Describe the work being handed over (min 10 characters)'),
    startDate: isoDate,
    endDate: isoDate,
    priority: z.enum(PRIORITIES).default('MEDIUM'),
    instructions: optionalText(4000),
    tasks: z.array(handoverTaskInputSchema).max(50).default([]),
  })
  .refine((h) => h.endDate >= h.startDate, { message: 'Handover end date must be after start date', path: ['endDate'] });
export type HandoverInput = z.infer<typeof handoverInputSchema>;

const leaveBase = z.object({
  leaveType: text(20).min(1, 'Select a leave type'),
  startDate: isoDate,
  endDate: isoDate,
  halfDay: z.enum(HALF_DAY_OPTIONS).default('NONE'),
  reason: text(1000).min(5, 'Please provide a reason (min 5 characters)'),
  emergencyContact: optionalText(100),
  contactDuringLeave: optionalText(200),
  attachmentName: optionalText(255),
  attachmentUrl: optionalText(500),
});

export const leaveApplicationSchema = leaveBase
  .extend({ handover: handoverInputSchema.optional() })
  .refine((l) => l.endDate >= l.startDate, { message: 'End date cannot be before start date', path: ['endDate'] })
  .refine((l) => l.halfDay === 'NONE' || l.startDate === l.endDate, {
    message: 'Half day is only allowed for single-day leave',
    path: ['halfDay'],
  });
export type LeaveApplicationInput = z.infer<typeof leaveApplicationSchema>;

export const leavePreviewSchema = z.object({
  leaveType: text(20).min(1),
  startDate: isoDate,
  endDate: isoDate,
  halfDay: z.enum(HALF_DAY_OPTIONS).default('NONE'),
  excludeLeaveId: optionalText(30),
});
export type LeavePreviewInput = z.infer<typeof leavePreviewSchema>;

export const decisionSchema = z.object({
  comment: optionalText(1000),
});
export const rejectionSchema = z.object({
  comment: text(1000).min(5, 'Please provide a reason (min 5 characters)'),
});

export const employeeInputSchema = z.object({
  employeeName: text(100).min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: optionalText(30),
  department: text(100).min(1, 'Department is required'),
  designation: text(100).min(2, 'Designation is required'),
  managerId: optionalText(20),
  joiningDate: isoDate,
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).default('ACTIVE'),
  role: z.enum(ROLES).default('EMPLOYEE'),
  profileImage: optionalText(500),
  workMode: z.enum(WORK_MODES).default('OFFICE'),
  location: optionalText(100),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export const leaveTypeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,9}$/, 'Code must be 2-10 letters/digits'),
  name: text(80).min(2, 'Name is required'),
  description: optionalText(500),
  annualAllocation: z.coerce.number().min(0).max(365),
  isPaid: z.boolean().default(true),
  trackBalance: z.boolean().default(true),
  allowHalfDay: z.boolean().default(true),
  allowCarryForward: z.boolean().default(false),
  maxCarryForward: z.coerce.number().min(0).max(365).default(0),
  maxConsecutiveDays: z.coerce.number().min(0).max(365).default(0),
  minNoticeDays: z.coerce.number().min(0).max(90).default(0),
  backdatedDays: z.coerce.number().min(0).max(90).default(0),
  requiresApproval: z.boolean().default(true),
  requiresAttachmentAfterDays: z.coerce.number().min(0).max(365).default(0),
  excludeWeekendsAndHolidays: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4F46E5').default('#4F46E5'),
  isActive: z.boolean().default(true),
  includeInTotals: z.boolean().default(true),
});
export type LeaveTypeInput = z.infer<typeof leaveTypeInputSchema>;

export const holidayInputSchema = z.object({
  holidayName: text(100).min(2, 'Holiday name is required'),
  holidayDate: isoDate,
  holidayType: z.enum(HOLIDAY_TYPES).default('PUBLIC'),
  description: optionalText(500),
});
export type HolidayInput = z.infer<typeof holidayInputSchema>;

export const departmentInputSchema = z.object({
  departmentName: text(100).min(2, 'Department name is required'),
  headId: optionalText(20),
  description: optionalText(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4F46E5'),
});
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export const balanceAdjustmentSchema = z.object({
  leaveType: text(20).min(1, 'Select a leave type'),
  days: z.coerce
    .number()
    .min(-365)
    .max(365)
    .refine((d) => d !== 0, 'Adjustment cannot be zero')
    .refine((d) => Math.round(d * 2) === d * 2, 'Use whole or half days'),
  reason: text(500).min(5, 'Please provide a reason (min 5 characters)'),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type BalanceAdjustmentInput = z.infer<typeof balanceAdjustmentSchema>;

export const compOffSchema = z.object({
  days: z.coerce
    .number()
    .min(0.5)
    .max(10)
    .refine((d) => Math.round(d * 2) === d * 2, 'Use whole or half days'),
  workedOn: isoDate,
  reason: text(500).min(5, 'Please provide a reason (min 5 characters)'),
});
export type CompOffInput = z.infer<typeof compOffSchema>;

export const taskUpdateSchema = handoverTaskInputSchema.partial().extend({
  taskStatus: z.enum(TASK_STATUSES).optional(),
  comments: text(2000).optional(),
});
export type TaskUpdateInput = z.input<typeof taskUpdateSchema>;

export const settingsInputSchema = z
  .object({
    organizationName: text(120).min(2),
    organizationEmail: z.union([z.string().email(), z.literal('')]),
    organizationAddress: text(300),
    timezone: text(60).min(2),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one working day'),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
    requireHandover: z.boolean(),
    requireHandoverAcceptanceBeforeApproval: z.boolean(),
    allowSelfApprovalForAdmins: z.boolean(),
    teamOverlapWarningPercent: z.coerce.number().min(0).max(100),
    backupOverloadThreshold: z.coerce.number().int().min(1).max(20),
    remoteWorkEnabled: z.boolean(),
    autoCompleteHandovers: z.boolean(),
    notifyInApp: z.boolean(),
    notifyEmail: z.boolean(),
    notifyLeaveStartReminder: z.boolean(),
    notifyTaskOverdue: z.boolean(),
    notificationPollSeconds: z.coerce.number().int().min(10).max(600),
    backupRetentionCount: z.coerce.number().int().min(1).max(200),
  })
  .partial();
export type SettingsInput = z.infer<typeof settingsInputSchema>;
