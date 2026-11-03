import { Chip, alpha, type ChipProps } from '@mui/material';
import {
  HANDOVER_STATUS_LABELS,
  LEAVE_STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type HandoverStatus,
  type LeaveStatus,
  type Priority,
  type TaskStatus,
} from '@leaveflow/shared';
import { handoverStatusTone, leaveStatusTone, priorityTone, taskStatusTone, toneColor, type StatusTone } from '@/theme/tokens';

interface ToneChipProps extends Omit<ChipProps, 'color'> {
  tone: StatusTone;
  dot?: boolean;
}

/** Soft, colour-coded pill used for every status in the app. */
export function ToneChip({ tone, dot = true, label, sx, size = 'small', ...rest }: ToneChipProps) {
  const color = toneColor[tone];
  return (
    <Chip
      size={size}
      label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
          {label}
        </span>
      }
      sx={{ bgcolor: alpha(color, 0.1), color, border: `1px solid ${alpha(color, 0.2)}`, height: 24, fontSize: 12, ...sx }}
      {...rest}
    />
  );
}

export const LeaveStatusChip = ({ status }: { status: LeaveStatus }) => <ToneChip tone={leaveStatusTone[status]} label={LEAVE_STATUS_LABELS[status]} />;
export const HandoverStatusChip = ({ status }: { status: HandoverStatus }) => (
  <ToneChip tone={handoverStatusTone[status]} label={HANDOVER_STATUS_LABELS[status]} />
);
export const TaskStatusChip = ({ status }: { status: TaskStatus }) => <ToneChip tone={taskStatusTone[status]} label={TASK_STATUS_LABELS[status]} />;
export const PriorityChip = ({ priority }: { priority: Priority }) => <ToneChip tone={priorityTone[priority]} dot={false} label={PRIORITY_LABELS[priority]} />;

export function LeaveTypeChip({ name, color }: { name: string; color: string }) {
  return <Chip size="small" label={name} sx={{ bgcolor: alpha(color, 0.1), color, fontWeight: 600, height: 24, fontSize: 12 }} />;
}
