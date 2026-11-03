import { useState } from 'react';
import { Box, Card, FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Eye, ListTodo } from 'lucide-react';
import { PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@leaveflow/shared';
import { useTasksQuery, useUpdateTaskMutation } from '@/app/store/api';
import { DataTable, EmployeeCell, FilterSelect, HandoverStatusChip, PageHeader, PriorityChip, TaskStatusChip, ToneChip, optionsFrom, type Column } from '@/components/common';
import { useAction, useAuth } from '@/hooks';
import type { TaskListItem } from '@/services/repositories';
import { fmtDate } from '@/utils/format';
import { HandoverDetailsDrawer } from '../handovers/HandoverDetailsDrawer';

/** Every handover task in one place, with inline status updates. */
export default function TasksPage() {
  const run = useAction();
  const { user, isManager, isAdmin } = useAuth();
  const [scope, setScope] = useState<'mine' | 'team' | 'all'>(isManager ? 'team' : 'mine');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [handoverId, setHandoverId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useTasksQuery({ scope, status, priority, overdue: overdue || undefined });
  const [updateTask] = useUpdateTaskMutation();

  const canEdit = (t: TaskListItem) =>
    ['ACCEPTED', 'ACTIVE'].includes(t.handover.handoverStatus) &&
    (t.assignedEmployeeId === user?.employeeId || t.handover.backupEmployeeId === user?.employeeId || t.handover.employeeId === user?.employeeId || isManager);

  const columns: Column<TaskListItem>[] = [
    {
      id: 'task',
      label: 'Task',
      minWidth: 220,
      sortValue: (t) => t.taskTitle,
      searchValue: (t) => `${t.taskTitle} ${t.taskDescription} ${t.handover.handoverTitle}`,
      render: (t) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 280 }}>{t.taskTitle}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ maxWidth: 280 }}>{t.handover.handoverTitle} · for {t.handover.employeeName}</Typography>
        </Box>
      ),
    },
    { id: 'assignee', label: 'Assigned to', sortValue: (t) => t.assignee?.employeeName ?? '', searchValue: (t) => t.assignee?.employeeName ?? '', render: (t) => <EmployeeCell employee={t.assignee} size={28} /> },
    { id: 'priority', label: 'Priority', sortValue: (t) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(t.priority), render: (t) => <PriorityChip priority={t.priority} /> },
    {
      id: 'due',
      label: 'Due',
      sortValue: (t) => t.dueDate || '9999',
      render: (t) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">{fmtDate(t.dueDate)}</Typography>
          {t.isOverdue && <ToneChip tone="error" label="Overdue" dot={false} sx={{ height: 20, fontSize: 10 }} />}
        </Stack>
      ),
    },
    { id: 'handover', label: 'Handover', sortValue: (t) => t.handover.handoverStatus, render: (t) => <HandoverStatusChip status={t.handover.handoverStatus} />, hideBelow: 'lg' },
    {
      id: 'status',
      label: 'Status',
      sortValue: (t) => TASK_STATUSES.indexOf(t.taskStatus),
      searchValue: (t) => TASK_STATUS_LABELS[t.taskStatus],
      render: (t) =>
        canEdit(t) ? (
          <TextField
            select
            value={t.taskStatus}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => void run(updateTask({ taskId: t.taskId, input: { taskStatus: e.target.value as TaskStatus } }).unwrap(), 'Task updated')}
            sx={{ minWidth: 140 }}
            slotProps={{ htmlInput: { 'aria-label': `Status of ${t.taskTitle}` } }}
          >
            {TASK_STATUSES.map((s) => <MenuItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</MenuItem>)}
          </TextField>
        ) : (
          <TaskStatusChip status={t.taskStatus} />
        ),
    },
    { id: 'actions', label: '', align: 'right', hideOnCard: true, render: (t) => <Tooltip title="Open handover"><IconButton size="small" onClick={() => setHandoverId(t.handoverId)}><Eye size={17} /></IconButton></Tooltip> },
  ];

  return (
    <Box>
      <PageHeader icon={<ListTodo size={22} />} title="Handover tasks" subtitle="Monitor the work being covered while colleagues are away." />
      <Card sx={{ mb: 2 }}>
        <Tabs value={scope} onChange={(_, v) => setScope(v)} sx={{ px: 1 }}>
          <Tab value="mine" label="My tasks" />
          {isManager && <Tab value="team" label={isAdmin ? 'Organisation' : 'My team'} />}
        </Tabs>
      </Card>
      <DataTable
        rows={data}
        columns={columns}
        rowKey={(t) => t.taskId}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(t) => setHandoverId(t.handoverId)}
        initialSort={{ id: 'due', direction: 'asc' }}
        pageSize={15}
        searchPlaceholder="Search tasks, handovers, people…"
        toolbar={
          <>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={optionsFrom(TASK_STATUS_LABELS)} minWidth={140} />
            <FilterSelect label="Priority" value={priority} onChange={setPriority} options={optionsFrom(PRIORITY_LABELS)} minWidth={130} />
            <FormControlLabel control={<Switch checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />} label="Overdue only" />
          </>
        }
        emptyTitle="No tasks found"
        emptyDescription="Tasks added to work handovers appear here."
        emptyIcon={<ListTodo size={24} />}
      />
      <HandoverDetailsDrawer handoverId={handoverId} onClose={() => setHandoverId(null)} />
    </Box>
  );
}
