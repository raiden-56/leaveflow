import { useState } from 'react';
import { Box, Chip, IconButton, Link, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CalendarClock, ExternalLink, MessageSquare, Trash2 } from 'lucide-react';
import { TASK_STATUSES, TASK_STATUS_LABELS, type HandoverTaskView, type TaskStatus } from '@leaveflow/shared';
import { useDeleteTaskMutation, useUpdateTaskMutation } from '@/app/store/api';
import { ConfirmDialog, EmployeeAvatar, PriorityChip, TaskStatusChip } from '@/components/common';
import { useAction } from '@/hooks';
import { fmtDate } from '@/utils/format';

interface TaskListProps {
  tasks: HandoverTaskView[];
  /** Users who may change task status (backup, assignee, owner, manager). */
  canUpdateStatus: (t: HandoverTaskView) => boolean;
  canDelete?: boolean;
}

/** Handover tasks with inline status updates, comments and deletion. */
export function TaskList({ tasks, canUpdateStatus, canDelete }: TaskListProps) {
  const run = useAction();
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();
  const [toDelete, setToDelete] = useState<HandoverTaskView | null>(null);
  const [commenting, setCommenting] = useState<HandoverTaskView | null>(null);

  if (tasks.length === 0) return <Typography variant="body2" color="text.secondary">No tasks were added to this handover.</Typography>;

  const setStatus = (t: HandoverTaskView, taskStatus: TaskStatus) =>
    run(updateTask({ taskId: t.taskId, input: { taskStatus } }).unwrap(), `Task marked ${TASK_STATUS_LABELS[taskStatus].toLowerCase()}`);

  return (
    <Stack spacing={1.25}>
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <motion.div key={t.taskId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <Box sx={{ p: 1.75, border: 1, borderColor: t.isOverdue ? 'error.light' : 'divider', borderRadius: 1, bgcolor: t.taskStatus === 'COMPLETED' ? 'action.hover' : 'background.paper' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ textDecoration: t.taskStatus === 'COMPLETED' ? 'line-through' : 'none' }}>
                    {t.taskTitle}
                  </Typography>
                  {t.taskDescription && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{t.taskDescription}</Typography>}
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                  <PriorityChip priority={t.priority} />
                  {canDelete && (
                    <Tooltip title="Delete task">
                      <IconButton size="small" onClick={() => setToDelete(t)} aria-label="Delete task"><Trash2 size={15} /></IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <EmployeeAvatar name={t.assignee?.employeeName} size={22} />
                  <Typography variant="caption">{t.assignee?.employeeName ?? 'Unassigned'}</Typography>
                </Stack>
                {t.dueDate && (
                  <Chip size="small" icon={t.isOverdue ? <AlertCircle size={13} /> : <CalendarClock size={13} />} label={`Due ${fmtDate(t.dueDate, 'DD MMM')}`} color={t.isOverdue ? 'error' : 'default'} variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                )}
                {t.referenceLinks && (
                  <Link href={t.referenceLinks.split(/\s|,/)[0]} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    Reference <ExternalLink size={12} />
                  </Link>
                )}
                <Box sx={{ flex: 1 }} />
                {canUpdateStatus(t) ? (
                  <TextField select value={t.taskStatus} onChange={(e) => setStatus(t, e.target.value as TaskStatus)} sx={{ minWidth: 140 }} slotProps={{ htmlInput: { 'aria-label': 'Task status' } }}>
                    {TASK_STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TaskStatusChip status={t.taskStatus} />
                )}
                {canUpdateStatus(t) && (
                  <Tooltip title="Add progress comment">
                    <IconButton size="small" onClick={() => setCommenting(t)} aria-label="Add comment"><MessageSquare size={15} /></IconButton>
                  </Tooltip>
                )}
              </Stack>
              {(t.expectedOutcome || t.comments || t.notes) && (
                <Stack spacing={0.5} sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
                  {t.expectedOutcome && <Typography variant="caption"><b>Expected outcome:</b> {t.expectedOutcome}</Typography>}
                  {t.notes && <Typography variant="caption"><b>Notes:</b> {t.notes}</Typography>}
                  {t.comments && <Typography variant="caption" color="primary.main"><b>Progress:</b> {t.comments}</Typography>}
                </Stack>
              )}
            </Box>
          </motion.div>
        ))}
      </AnimatePresence>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete task?"
        description={`"${toDelete?.taskTitle}" will be removed from this handover.`}
        confirmLabel="Delete"
        confirmColor="error"
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await run(deleteTask(toDelete.taskId).unwrap(), 'Task deleted');
          setToDelete(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(commenting)}
        title="Progress update"
        description={`Add a progress note for "${commenting?.taskTitle}".`}
        commentLabel="Comment"
        commentRequired
        confirmLabel="Save"
        onClose={() => setCommenting(null)}
        onConfirm={async (comment) => {
          if (commenting) await run(updateTask({ taskId: commenting.taskId, input: { comments: comment } }).unwrap(), 'Comment saved');
          setCommenting(null);
        }}
      />
    </Stack>
  );
}
