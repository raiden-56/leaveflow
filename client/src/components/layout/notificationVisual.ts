import { AlarmClock, Bell, CalendarCheck, CalendarClock, CalendarX, CheckCircle2, Coins, FilePen, Handshake, LogIn, Send, UserX, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '@leaveflow/shared';
import { palette } from '@/theme/tokens';

const MAP: Record<NotificationType, { icon: LucideIcon; color: string }> = {
  LEAVE_SUBMITTED: { icon: Send, color: palette.indigo },
  LEAVE_APPROVED: { icon: CalendarCheck, color: palette.approved },
  LEAVE_REJECTED: { icon: CalendarX, color: palette.rejected },
  LEAVE_CHANGES_REQUESTED: { icon: FilePen, color: palette.inProgress },
  LEAVE_CANCELLED: { icon: CalendarX, color: palette.neutral },
  HANDOVER_ASSIGNED: { icon: Handshake, color: palette.pending },
  HANDOVER_ACCEPTED: { icon: CheckCircle2, color: palette.teal },
  HANDOVER_DECLINED: { icon: UserX, color: palette.rejected },
  HANDOVER_COMPLETED: { icon: CheckCircle2, color: palette.approved },
  TASK_OVERDUE: { icon: AlarmClock, color: palette.rejected },
  LEAVE_STARTS_TOMORROW: { icon: CalendarClock, color: palette.pending },
  EMPLOYEE_RETURNED: { icon: LogIn, color: palette.teal },
  BALANCE_ADJUSTED: { icon: Coins, color: palette.indigo },
  GENERAL: { icon: Bell, color: palette.neutral },
};

export const notificationVisual = (type: NotificationType) => MAP[type] ?? MAP.GENERAL;
