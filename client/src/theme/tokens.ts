import type { HandoverStatus, LeaveStatus, Priority, TaskStatus } from '@leaveflow/shared';

/** Design tokens — the single source of colour for the whole application. */
export const palette = {
  navy: '#172554',
  indigo: '#4F46E5',
  indigoDark: '#4338CA',
  primaryLight: '#EEF2FF',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  approved: '#16A34A',
  pending: '#D97706',
  rejected: '#DC2626',
  inProgress: '#2563EB',
  neutral: '#64748B',
} as const;

export const darkPalette = {
  background: '#0B1120',
  surface: '#111827',
  border: '#1F2937',
  text: '#E5E7EB',
  textSecondary: '#94A3B8',
} as const;

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

export const toneColor: Record<StatusTone, string> = {
  success: palette.approved,
  warning: palette.pending,
  error: palette.rejected,
  info: palette.inProgress,
  neutral: palette.neutral,
  primary: palette.indigo,
};

export const leaveStatusTone: Record<LeaveStatus, StatusTone> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'error',
  CHANGES_REQUESTED: 'info',
  CANCELLED: 'neutral',
};

export const handoverStatusTone: Record<HandoverStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_ACCEPTANCE: 'warning',
  ACCEPTED: 'primary',
  DECLINED: 'error',
  ACTIVE: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export const taskStatusTone: Record<TaskStatus, StatusTone> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  BLOCKED: 'error',
  COMPLETED: 'success',
};

export const priorityTone: Record<Priority, StatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
};

/** Chart series colours (accessible on light & dark surfaces). */
export const chartColors = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#2563EB', '#16A34A', '#7C3AED', '#EA580C', '#0891B2', '#64748B'];
