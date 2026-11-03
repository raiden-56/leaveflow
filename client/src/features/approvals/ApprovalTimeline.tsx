import { Box, Stack, Typography, alpha } from '@mui/material';
import { CheckCircle2, CircleSlash, FilePen, Handshake, Play, Send, UserCheck, UserX, XCircle, type LucideIcon } from 'lucide-react';
import type { ApprovalAction, ApprovalView } from '@leaveflow/shared';
import { palette } from '@/theme/tokens';
import { fmtDateTime } from '@/utils/format';

const ACTION: Record<ApprovalAction, { label: string; icon: LucideIcon; color: string }> = {
  SUBMITTED: { label: 'submitted', icon: Send, color: palette.indigo },
  RESUBMITTED: { label: 'resubmitted', icon: Send, color: palette.indigo },
  APPROVED: { label: 'approved the leave', icon: CheckCircle2, color: palette.approved },
  REJECTED: { label: 'rejected the leave', icon: XCircle, color: palette.rejected },
  CHANGES_REQUESTED: { label: 'requested changes', icon: FilePen, color: palette.inProgress },
  CANCELLED: { label: 'cancelled', icon: CircleSlash, color: palette.neutral },
  ACCEPTED: { label: 'accepted the handover', icon: UserCheck, color: palette.teal },
  DECLINED: { label: 'declined the handover', icon: UserX, color: palette.rejected },
  ACTIVATED: { label: 'handover activated', icon: Play, color: palette.inProgress },
  COMPLETED: { label: 'handover completed', icon: Handshake, color: palette.approved },
};

/** Chronological audit trail of a leave request and its handover. */
export function ApprovalTimeline({ history }: { history: ApprovalView[] }) {
  if (history.length === 0) return <Typography variant="body2" color="text.secondary">No activity yet.</Typography>;
  return (
    <Stack spacing={0}>
      {history.map((h, i) => {
        const meta = ACTION[h.action];
        const Icon = meta.icon;
        const subject = h.entityType === 'HANDOVER' && ['SUBMITTED', 'RESUBMITTED', 'CANCELLED'].includes(h.action) ? ` handover` : '';
        return (
          <Stack key={h.approvalId} direction="row" spacing={1.5}>
            <Stack alignItems="center">
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha(meta.color, 0.12), color: meta.color, flexShrink: 0 }}>
                <Icon size={15} />
              </Box>
              {i < history.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 16, bgcolor: 'divider', my: 0.5 }} />}
            </Stack>
            <Box sx={{ pb: 2, minWidth: 0 }}>
              <Typography variant="body2">
                <b>{h.actor?.employeeName ?? (h.actorId === 'SYSTEM' ? 'LeaveFlow' : h.actorId)}</b> {meta.label}
                {subject}
              </Typography>
              {h.comment && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontStyle: 'italic', wordBreak: 'break-word' }}>
                  “{h.comment}”
                </Typography>
              )}
              <Typography variant="caption" color="text.disabled">{fmtDateTime(h.createdAt)}</Typography>
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}
