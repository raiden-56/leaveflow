import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Collapse, Divider, Grid, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Plus, UserCheck, UserX } from 'lucide-react';
import { PRIORITIES, PRIORITY_LABELS, handoverTaskInputSchema, type HandoverTaskInput, type WorkHandoverView } from '@leaveflow/shared';
import { useAcceptHandoverMutation, useAddTaskMutation, useCompleteHandoverMutation, useDeclineHandoverMutation, useEmployeesQuery, useHandoverQuery } from '@/app/store/api';
import { ConfirmDialog, DetailPanel, EmployeeCell, ErrorState, HandoverStatusChip, LoadingButton, PriorityChip, TableSkeleton } from '@/components/common';
import { useAction, useAuth } from '@/hooks';
import { fmtDate, fmtDateTime, fmtRange } from '@/utils/format';
import { TaskList } from './TaskList';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" component="div" sx={{ mt: 0.25, wordBreak: 'break-word' }}>{children}</Typography>
    </Box>
  );
}

function AddTaskForm({ handover, onDone }: { handover: WorkHandoverView; onDone: () => void }) {
  const run = useAction();
  const [addTask, { isLoading }] = useAddTaskMutation();
  const { data: employees } = useEmployeesQuery();
  const { control, register, handleSubmit, formState: { errors } } = useForm<HandoverTaskInput>({
    resolver: zodResolver(handoverTaskInputSchema) as never,
    defaultValues: { taskTitle: '', taskDescription: '', priority: 'MEDIUM', dueDate: '', assignedEmployeeId: handover.backupEmployeeId, referenceLinks: '', expectedOutcome: '', notes: '' },
  });
  const submit = handleSubmit(async (values) => {
    const ok = await run(addTask({ handoverId: handover.handoverId, input: values }).unwrap(), 'Task added');
    if (ok) onDone();
  });
  return (
    <Box component="form" onSubmit={submit} sx={{ p: 2, border: 1, borderColor: 'primary.light', borderRadius: 1, bgcolor: 'background.default' }}>
      <Grid container spacing={1.5}>
        <Grid size={12}>
          <TextField fullWidth label="Task name" {...register('taskTitle')} error={!!errors.taskTitle} helperText={errors.taskTitle?.message} />
        </Grid>
        <Grid size={12}>
          <TextField fullWidth multiline minRows={2} label="Description" {...register('taskDescription')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Controller name="priority" control={control} render={({ field }) => (
            <TextField select fullWidth label="Priority" {...field}>
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{PRIORITY_LABELS[p]}</MenuItem>)}
            </TextField>
          )} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField fullWidth type="date" label="Due date" {...register('dueDate')} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Controller name="assignedEmployeeId" control={control} render={({ field }) => (
            <TextField select fullWidth label="Assignee" {...field}>
              {(employees ?? []).filter((e) => e.employeeId !== handover.employeeId).map((e) => <MenuItem key={e.employeeId} value={e.employeeId}>{e.employeeName}</MenuItem>)}
            </TextField>
          )} />
        </Grid>
        <Grid size={12}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onDone} color="inherit">Cancel</Button>
            <LoadingButton type="submit" variant="contained" loading={isLoading}>Add task</LoadingButton>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

/** Full handover view: details, tasks, accept/decline/complete actions. */
export function HandoverDetailsDrawer({ handoverId, onClose }: { handoverId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const run = useAction();
  const { user, isAdmin } = useAuth();
  const { data: h, isLoading, error, refetch } = useHandoverQuery(handoverId ?? '', { skip: !handoverId });
  const [accept, { isLoading: accepting }] = useAcceptHandoverMutation();
  const [decline, { isLoading: declining }] = useDeclineHandoverMutation();
  const [complete, { isLoading: completing }] = useCompleteHandoverMutation();
  const [dialog, setDialog] = useState<'accept' | 'decline' | 'complete' | null>(null);
  const [adding, setAdding] = useState(false);

  const me = user?.employeeId;
  const isBackup = h?.backupEmployeeId === me;
  const isOwner = h?.employeeId === me;
  const isManager = isAdmin || (user?.role === 'MANAGER' && !isOwner && !isBackup);
  const open = h && !['COMPLETED', 'CANCELLED'].includes(h.handoverStatus);
  const done = h?.tasks.filter((t) => t.taskStatus === 'COMPLETED').length ?? 0;

  const actions = h && (
    <>
      {isBackup && h.handoverStatus === 'PENDING_ACCEPTANCE' && (
        <>
          <Button color="error" variant="outlined" startIcon={<UserX size={16} />} onClick={() => setDialog('decline')}>Decline</Button>
          <Button variant="contained" color="success" startIcon={<UserCheck size={16} />} onClick={() => setDialog('accept')}>Accept handover</Button>
        </>
      )}
      {isOwner && h.handoverStatus === 'DECLINED' && h.leaveStatus && ['PENDING', 'CHANGES_REQUESTED'].includes(h.leaveStatus) && (
        <Button variant="contained" onClick={() => navigate(`/apply-leave?edit=${h.leaveId}`)}>Choose another backup</Button>
      )}
      {h.handoverStatus === 'ACTIVE' && (isOwner || isBackup || isManager) && (
        <Button variant="contained" color="success" startIcon={<CheckCircle2 size={16} />} onClick={() => setDialog('complete')}>Mark completed</Button>
      )}
    </>
  );

  return (
    <DetailPanel
      open={Boolean(handoverId)}
      onClose={onClose}
      title={h ? h.handoverTitle : 'Work handover'}
      subtitle={h && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}><span>{h.handoverId} · Leave {h.leaveId}</span><HandoverStatusChip status={h.handoverStatus} /></Stack>}
      actions={actions}
      width={620}
    >
      {isLoading && <TableSkeleton rows={5} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {h && (
        <Stack spacing={3}>
          {h.handoverStatus === 'PENDING_ACCEPTANCE' && isBackup && (
            <Alert severity="warning">{h.employee?.employeeName} is waiting for you to accept or decline this handover.</Alert>
          )}
          {h.handoverStatus === 'DECLINED' && <Alert severity="error">Declined: {h.declineReason}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">Handed over by</Typography>
              <Box sx={{ mt: 0.75 }}><EmployeeCell employee={h.employee} /></Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">Backup employee</Typography>
              <Box sx={{ mt: 0.75 }}><EmployeeCell employee={h.backupEmployee} /></Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Period">{fmtRange(h.startDate, h.endDate)}</Field></Grid>
            <Grid size={{ xs: 6, sm: 4 }}><Field label="Priority"><PriorityChip priority={h.priority} /></Field></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><Field label="Accepted">{h.acceptedDate ? fmtDateTime(h.acceptedDate) : '—'}</Field></Grid>
            <Grid size={12}><Field label="Work description">{h.handoverDescription}</Field></Grid>
            {h.instructions && <Grid size={12}><Field label="Important instructions">{h.instructions}</Field></Grid>}
            {h.completedDate && <Grid size={12}><Field label="Completed on">{fmtDate(h.completedDate)}</Field></Grid>}
          </Grid>

          <Divider />
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Tasks ({done}/{h.tasks.length})</Typography>
              {open && (isOwner || isBackup || isManager) && !adding && (
                <Button size="small" startIcon={<Plus size={15} />} onClick={() => setAdding(true)}>Add task</Button>
              )}
            </Stack>
            <LinearProgress variant="determinate" value={h.tasks.length ? (done / h.tasks.length) * 100 : 0} color="success" sx={{ mb: 2, height: 6 }} />
            <Collapse in={adding} unmountOnExit>
              <Box sx={{ mb: 2 }}><AddTaskForm handover={h} onDone={() => setAdding(false)} /></Box>
            </Collapse>
            <TaskList
              tasks={h.tasks}
              canUpdateStatus={(t) => Boolean(open) && h.handoverStatus !== 'PENDING_ACCEPTANCE' && (t.assignedEmployeeId === me || isBackup || isOwner || isManager)}
              canDelete={Boolean(open) && (isOwner || isManager)}
            />
          </Box>
        </Stack>
      )}

      <ConfirmDialog
        open={dialog === 'accept'}
        title="Accept handover?"
        description={`You'll be responsible for "${h?.handoverTitle}" from ${fmtRange(h?.startDate ?? '', h?.endDate ?? '')}.`}
        commentLabel="Message to the employee"
        confirmLabel="Accept"
        confirmColor="success"
        loading={accepting}
        onClose={() => setDialog(null)}
        onConfirm={async (comment) => {
          await run(accept({ id: h!.handoverId, comment }).unwrap(), 'Handover accepted');
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'decline'}
        title="Decline handover"
        description="Let the employee know why you can't take this on so they can choose someone else."
        commentLabel="Reason"
        commentRequired
        confirmLabel="Decline"
        confirmColor="error"
        loading={declining}
        onClose={() => setDialog(null)}
        onConfirm={async (comment) => {
          await run(decline({ id: h!.handoverId, comment }).unwrap(), 'Handover declined');
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'complete'}
        title="Mark handover completed?"
        description="Responsibilities are handed back to the employee. This cannot be undone."
        commentLabel="Handback notes"
        confirmLabel="Complete"
        confirmColor="success"
        loading={completing}
        onClose={() => setDialog(null)}
        onConfirm={async (comment) => {
          await run(complete({ id: h!.handoverId, comment }).unwrap(), 'Handover completed');
          setDialog(null);
        }}
      />
    </DetailPanel>
  );
}
