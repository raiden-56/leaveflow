import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, Box, Button, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { CheckCircle2, ExternalLink, FilePen, Paperclip, Pencil, Repeat2, XCircle, Ban } from 'lucide-react';
import { HALF_DAY_LABELS, type LeaveDetails } from '@leaveflow/shared';
import {
  useAcceptHandoverMutation,
  useApproveLeaveMutation,
  useCancelLeaveMutation,
  useDeclineHandoverMutation,
  useLeaveQuery,
  useRejectLeaveMutation,
  useRequestLeaveChangesMutation,
} from '@/app/store/api';
import { ConfirmDialog, DetailPanel, EmployeeCell, ErrorState, HandoverStatusChip, LeaveStatusChip, LeaveTypeChip, TableSkeleton } from '@/components/common';
import { useAction, useAuth, useToday } from '@/hooks';
import { fmtDate, fmtDays, fmtRange } from '@/utils/format';
import { ApprovalTimeline } from '../approvals/ApprovalTimeline';
import { TaskList } from '../handovers/TaskList';

type DialogKind = 'approve' | 'reject' | 'changes' | 'cancel' | 'accept' | 'decline' | null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" component="div" sx={{ mt: 0.25, wordBreak: 'break-word' }}>{children || '—'}</Typography>
    </Box>
  );
}

/** Insight warnings shown to approvers before deciding. */
export function LeaveWarnings({ leave }: { leave: LeaveDetails }) {
  const warnings = leave.insights.warnings;
  if (!warnings.length) {
    return leave.status === 'PENDING' ? <Alert severity="success">No conflicts detected — handover and team coverage look good.</Alert> : null;
  }
  return (
    <Stack spacing={1}>
      {warnings.map((w) => (
        <Alert key={w.code} severity={w.severity === 'error' ? 'error' : w.severity === 'warning' ? 'warning' : 'info'} sx={{ py: 0.25 }}>
          {w.message}
        </Alert>
      ))}
      {leave.insights.overlappingTeamLeaves.length > 0 && (
        <Box sx={{ pl: 1 }}>
          <Typography variant="caption" color="text.secondary">Overlapping team leave</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {leave.insights.overlappingTeamLeaves.map((o) => (
              <Typography key={o.leaveId} variant="body2">
                • {o.employee?.employeeName} — {o.leaveTypeName}, {fmtRange(o.startDate, o.endDate)} ({o.status.toLowerCase()})
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

/** Leave request details with role-aware actions (approve/reject/request changes/cancel/edit, accept/decline handover). */
export function LeaveDetailsDrawer({ leaveId, onClose }: { leaveId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const run = useAction();
  const today = useToday();
  const { user, isAdmin } = useAuth();
  const { data: leave, isLoading, error, refetch } = useLeaveQuery(leaveId ?? '', { skip: !leaveId });
  const [approve, approveState] = useApproveLeaveMutation();
  const [reject, rejectState] = useRejectLeaveMutation();
  const [requestChanges, changesState] = useRequestLeaveChangesMutation();
  const [cancel, cancelState] = useCancelLeaveMutation();
  const [accept, acceptState] = useAcceptHandoverMutation();
  const [decline, declineState] = useDeclineHandoverMutation();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const me = user?.employeeId;
  const isOwner = leave?.employeeId === me;
  const isApprover = Boolean(leave && !isOwner && (isAdmin || leave.approverId === me));
  const isBackup = leave?.handover?.backupEmployeeId === me;
  const canEdit = isOwner && leave && ['PENDING', 'CHANGES_REQUESTED'].includes(leave.status);
  const canCancel = leave && (isOwner || isAdmin) && (['PENDING', 'CHANGES_REQUESTED'].includes(leave.status) || (leave.status === 'APPROVED' && (leave.startDate > today || isAdmin)));
  const blocking = leave?.insights.warnings.some((w) => w.severity === 'error');

  const close = () => {
    setDialog(null);
  };
  const act = async (promise: Promise<unknown>, message: string) => {
    await run(promise, message);
    close();
  };

  const actions = leave && (
    <>
      {canCancel && <Button color="inherit" startIcon={<Ban size={16} />} onClick={() => setDialog('cancel')}>Cancel leave</Button>}
      {canEdit && (
        <Button variant={leave.status === 'CHANGES_REQUESTED' ? 'contained' : 'outlined'} startIcon={<Pencil size={16} />} onClick={() => navigate(`/apply-leave?edit=${leave.leaveId}`)}>
          Edit & resubmit
        </Button>
      )}
      {isBackup && leave.handover?.handoverStatus === 'PENDING_ACCEPTANCE' && (
        <>
          <Button color="error" variant="outlined" onClick={() => setDialog('decline')}>Decline handover</Button>
          <Button color="success" variant="contained" onClick={() => setDialog('accept')}>Accept handover</Button>
        </>
      )}
      {isApprover && leave.status === 'PENDING' && (
        <>
          <Button color="error" variant="outlined" startIcon={<XCircle size={16} />} onClick={() => setDialog('reject')}>Reject</Button>
          <Button color="info" variant="outlined" startIcon={<FilePen size={16} />} onClick={() => setDialog('changes')}>Request changes</Button>
          <Button color="success" variant="contained" startIcon={<CheckCircle2 size={16} />} onClick={() => setDialog('approve')}>Approve</Button>
        </>
      )}
    </>
  );

  return (
    <DetailPanel
      open={Boolean(leaveId)}
      onClose={onClose}
      title={leave ? `${leave.leaveTypeName} · ${leave.leaveId}` : 'Leave request'}
      subtitle={leave && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}><LeaveStatusChip status={leave.status} /><span>{fmtRange(leave.startDate, leave.endDate)}</span></Stack>}
      actions={actions}
      width={640}
    >
      {isLoading && <TableSkeleton rows={6} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {leave && (
        <Stack spacing={3}>
          {leave.status === 'CHANGES_REQUESTED' && (
            <Alert severity="info"><AlertTitle>Changes requested</AlertTitle>{leave.managerComment}</Alert>
          )}
          {leave.status === 'REJECTED' && (
            <Alert severity="error"><AlertTitle>Rejected by {leave.approver?.employeeName}</AlertTitle>{leave.rejectionReason}</Alert>
          )}
          {leave.status === 'APPROVED' && leave.managerComment && (
            <Alert severity="success"><AlertTitle>Approved by {leave.approver?.employeeName}</AlertTitle>{leave.managerComment}</Alert>
          )}
          {(isApprover || isOwner) && leave.status === 'PENDING' && <LeaveWarnings leave={leave} />}

          <Grid container spacing={2}>
            <Grid size={12}><EmployeeCell employee={leave.employee} secondary={`${leave.employee?.designation} · ${leave.employee?.department}`} size={42} /></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Leave type"><LeaveTypeChip name={leave.leaveTypeName} color={leave.leaveTypeColor} /></Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Duration">{fmtDays(leave.totalDays)}</Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Session">{HALF_DAY_LABELS[leave.halfDay]}</Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Start date">{fmtDate(leave.startDate)}</Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="End date">{fmtDate(leave.endDate)}</Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Applied on">{fmtDate(leave.appliedDate)}</Field></Grid>
            <Grid size={12}><Field label="Reason">{leave.reason}</Field></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Field label="Emergency contact">{leave.emergencyContact}</Field></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><Field label="Contact during leave">{leave.contactDuringLeave}</Field></Grid>
            {leave.attachmentName && (
              <Grid size={12}>
                <Field label="Attachment">
                  <Link href={leave.attachmentUrl} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <Paperclip size={14} /> {leave.attachmentName} <ExternalLink size={12} />
                  </Link>
                </Field>
              </Grid>
            )}
            {leave.insights.balance && (
              <Grid size={12}>
                <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">{leave.leaveTypeName} balance ({leave.insights.balance.year})</Typography>
                  <Typography variant="body2">
                    <b>{leave.insights.balance.available}</b> available · {leave.insights.balance.used} used · {leave.insights.balance.pending} pending of {leave.insights.balance.total}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>

          <Divider />
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Repeat2 size={18} />
                <Typography variant="subtitle1">Work handover</Typography>
              </Stack>
              {leave.handover && <HandoverStatusChip status={leave.handover.handoverStatus} />}
            </Stack>
            {leave.handover ? (
              <Stack spacing={2}>
                <Box sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2">{leave.handover.handoverTitle}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{leave.handover.handoverDescription}</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1.5 }} justifyContent="space-between">
                    <EmployeeCell employee={leave.handover.backupEmployee} secondary="Backup employee" />
                    <Field label="Coverage">{fmtRange(leave.handover.startDate, leave.handover.endDate)}</Field>
                  </Stack>
                  {leave.handover.instructions && <Typography variant="body2" sx={{ mt: 1.5 }}><b>Instructions:</b> {leave.handover.instructions}</Typography>}
                  {leave.handover.declineReason && <Alert severity="error" sx={{ mt: 1.5 }}>Declined: {leave.handover.declineReason}</Alert>}
                </Box>
                <TaskList tasks={leave.handover.tasks} canUpdateStatus={() => false} />
              </Stack>
            ) : (
              <Alert severity="warning">No work handover was created for this leave.</Alert>
            )}
          </Box>

          <Divider />
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Activity</Typography>
            <ApprovalTimeline history={leave.history} />
          </Box>
        </Stack>
      )}

      <ConfirmDialog
        open={dialog === 'approve'}
        title="Approve leave?"
        description={
          blocking
            ? 'There are unresolved warnings on this request (see above). You can still approve if you have confirmed coverage.'
            : `${leave?.employee?.employeeName} will be on leave ${fmtRange(leave?.startDate ?? '', leave?.endDate ?? '')}.`
        }
        commentLabel="Comment for the employee"
        confirmLabel="Approve"
        confirmColor="success"
        loading={approveState.isLoading}
        onClose={close}
        onConfirm={(comment) => act(approve({ id: leave!.leaveId, comment }).unwrap(), 'Leave approved')}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Reject leave"
        description="The employee will be notified and the reserved balance released."
        commentLabel="Reason for rejection"
        commentRequired
        confirmLabel="Reject"
        confirmColor="error"
        loading={rejectState.isLoading}
        onClose={close}
        onConfirm={(comment) => act(reject({ id: leave!.leaveId, comment }).unwrap(), 'Leave rejected')}
      />
      <ConfirmDialog
        open={dialog === 'changes'}
        title="Request changes"
        description="The employee can edit and resubmit the request."
        commentLabel="What should be changed?"
        commentRequired
        confirmLabel="Send request"
        loading={changesState.isLoading}
        onClose={close}
        onConfirm={(comment) => act(requestChanges({ id: leave!.leaveId, comment }).unwrap(), 'Change request sent')}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Cancel this leave?"
        description="Reserved or used days are returned to the balance and the handover is cancelled."
        commentLabel="Reason (optional)"
        confirmLabel="Cancel leave"
        confirmColor="error"
        loading={cancelState.isLoading}
        onClose={close}
        onConfirm={(reason) => act(cancel({ id: leave!.leaveId, reason }).unwrap(), 'Leave cancelled')}
      />
      <ConfirmDialog
        open={dialog === 'accept'}
        title="Accept handover?"
        description={`You'll cover "${leave?.handover?.handoverTitle}" during this leave.`}
        commentLabel="Message"
        confirmLabel="Accept"
        confirmColor="success"
        loading={acceptState.isLoading}
        onClose={close}
        onConfirm={(comment) => act(accept({ id: leave!.handover!.handoverId, comment }).unwrap(), 'Handover accepted')}
      />
      <ConfirmDialog
        open={dialog === 'decline'}
        title="Decline handover"
        commentLabel="Reason"
        commentRequired
        confirmLabel="Decline"
        confirmColor="error"
        loading={declineState.isLoading}
        onClose={close}
        onConfirm={(comment) => act(decline({ id: leave!.handover!.handoverId, comment }).unwrap(), 'Handover declined')}
      />
    </DetailPanel>
  );
}
