import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Card, Grid, IconButton, LinearProgress, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { AlarmClock, CheckCircle2, Eye, Hourglass, Repeat2, UserCheck } from 'lucide-react';
import { HANDOVER_STATUS_LABELS, PRIORITY_LABELS, isTaskOverdue, type WorkHandoverView } from '@leaveflow/shared';
import { useHandoversQuery } from '@/app/store/api';
import { DataTable, EmployeeCell, FilterSelect, HandoverStatusChip, PageHeader, PriorityChip, StatCard, ToneChip, optionsFrom, type Column } from '@/components/common';
import { useAuth, useToday } from '@/hooks';
import { palette } from '@/theme/tokens';
import { fmtRange } from '@/utils/format';
import { HandoverDetailsDrawer } from './HandoverDetailsDrawer';

type Scope = 'assigned' | 'created' | 'team' | 'all';

/** Handover dashboard: what I hand over, what I cover, and (for managers) the team's handovers. */
export default function HandoversPage() {
  const { user, isManager, isAdmin } = useAuth();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<Scope>('assigned');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = { scope, status, priority, from, to };
  const { data, isLoading, error, refetch } = useHandoversQuery(query);
  const { data: assigned } = useHandoversQuery({ scope: 'assigned' });
  const { data: created } = useHandoversQuery({ scope: 'created' });
  const openId = params.get('id');

  const stats = useMemo(() => {
    const mine = [...(assigned ?? []), ...(created ?? [])];
    const tasks = mine.flatMap((h) => (['ACCEPTED', 'ACTIVE'].includes(h.handoverStatus) ? h.tasks : []));
    return {
      pending: (assigned ?? []).filter((h) => h.handoverStatus === 'PENDING_ACCEPTANCE').length,
      active: mine.filter((h) => h.handoverStatus === 'ACTIVE').length,
      overdue: tasks.filter((t) => isTaskOverdue(t, today)).length,
      completedTasks: mine.flatMap((h) => h.tasks).filter((t) => t.taskStatus === 'COMPLETED').length,
    };
  }, [assigned, created, today]);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('id', id);
    else next.delete('id');
    setParams(next, { replace: true });
  };

  const columns: Column<WorkHandoverView>[] = [
    {
      id: 'title',
      label: 'Handover',
      minWidth: 220,
      sortValue: (h) => h.handoverTitle,
      searchValue: (h) => `${h.handoverId} ${h.handoverTitle} ${h.employee?.employeeName} ${h.backupEmployee?.employeeName}`,
      render: (h) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 260 }}>{h.handoverTitle}</Typography>
          <Typography variant="caption" color="text.secondary">{h.handoverId} · Leave {h.leaveId}</Typography>
        </Box>
      ),
    },
    { id: 'owner', label: scope === 'assigned' ? 'From' : 'Employee', sortValue: (h) => h.employee?.employeeName ?? '', render: (h) => <EmployeeCell employee={h.employee} size={30} />, hideBelow: scope === 'created' ? 'xl' : undefined },
    { id: 'backup', label: 'Backup', sortValue: (h) => h.backupEmployee?.employeeName ?? '', render: (h) => <EmployeeCell employee={h.backupEmployee} size={30} />, hideBelow: scope === 'assigned' ? 'xl' : undefined },
    { id: 'period', label: 'Period', sortValue: (h) => h.startDate, render: (h) => fmtRange(h.startDate, h.endDate) },
    { id: 'priority', label: 'Priority', sortValue: (h) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(h.priority), render: (h) => <PriorityChip priority={h.priority} />, hideBelow: 'lg' },
    {
      id: 'progress',
      label: 'Tasks',
      sortValue: (h) => h.completionStatus,
      render: (h) => {
        const done = h.tasks.filter((t) => t.taskStatus === 'COMPLETED').length;
        const overdue = h.tasks.filter((t) => t.isOverdue).length;
        return (
          <Stack spacing={0.5} sx={{ minWidth: 110 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="caption">{done}/{h.tasks.length} done</Typography>
              {overdue > 0 && ['ACCEPTED', 'ACTIVE'].includes(h.handoverStatus) && <ToneChip tone="error" label={`${overdue} overdue`} dot={false} sx={{ height: 18, fontSize: 10 }} />}
            </Stack>
            <LinearProgress variant="determinate" value={h.completionStatus} color={h.completionStatus === 100 ? 'success' : 'primary'} sx={{ height: 5 }} />
          </Stack>
        );
      },
    },
    { id: 'status', label: 'Status', sortValue: (h) => h.handoverStatus, searchValue: (h) => HANDOVER_STATUS_LABELS[h.handoverStatus], render: (h) => <HandoverStatusChip status={h.handoverStatus} /> },
    {
      id: 'actions',
      label: '',
      align: 'right',
      hideOnCard: true,
      render: (h) => (
        <Tooltip title={h.backupEmployeeId === user?.employeeId && h.handoverStatus === 'PENDING_ACCEPTANCE' ? 'Review & respond' : 'View'}>
          <IconButton size="small" color={h.backupEmployeeId === user?.employeeId && h.handoverStatus === 'PENDING_ACCEPTANCE' ? 'warning' : 'default'} onClick={() => setOpen(h.handoverId)}>
            {h.backupEmployeeId === user?.employeeId && h.handoverStatus === 'PENDING_ACCEPTANCE' ? <UserCheck size={17} /> : <Eye size={17} />}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader icon={<Repeat2 size={22} />} title="Work handovers" subtitle="Track responsibilities you hand over and the work you cover for colleagues." />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={0} label="Awaiting your acceptance" value={stats.pending} icon={<Hourglass size={20} />} color={palette.pending} onClick={() => { setScope('assigned'); setStatus('PENDING_ACCEPTANCE'); }} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={1} label="Active handovers" value={stats.active} icon={<Repeat2 size={20} />} color={palette.inProgress} onClick={() => setStatus('ACTIVE')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={2} label="Overdue tasks" value={stats.overdue} icon={<AlarmClock size={20} />} color={palette.rejected} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard index={3} label="Completed tasks" value={stats.completedTasks} icon={<CheckCircle2 size={20} />} color={palette.approved} /></Grid>
      </Grid>
      <Card sx={{ mb: 2 }}>
        <Tabs value={scope} onChange={(_, v) => setScope(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 1 }}>
          <Tab value="assigned" label={`Assigned to me (${assigned?.length ?? 0})`} />
          <Tab value="created" label={`Created by me (${created?.length ?? 0})`} />
          {isManager && <Tab value="team" label={isAdmin ? 'Organisation' : 'My team'} />}
        </Tabs>
      </Card>
      <DataTable
        rows={data}
        columns={columns}
        rowKey={(h) => h.handoverId}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={(h) => setOpen(h.handoverId)}
        searchPlaceholder="Search title, employee, backup…"
        initialSort={{ id: 'period', direction: 'desc' }}
        toolbar={
          <>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={optionsFrom(HANDOVER_STATUS_LABELS)} />
            <FilterSelect label="Priority" value={priority} onChange={setPriority} options={optionsFrom(PRIORITY_LABELS)} minWidth={130} />
            <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 145 }} />
            <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 145 }} />
          </>
        }
        emptyTitle={scope === 'assigned' ? 'Nothing assigned to you' : scope === 'created' ? 'No handovers yet' : 'No handovers'}
        emptyDescription={scope === 'assigned' ? 'When a colleague picks you as their backup, the handover shows up here.' : 'Handovers are created when you apply for leave.'}
        emptyIcon={<Repeat2 size={24} />}
      />
      <HandoverDetailsDrawer handoverId={openId} onClose={() => setOpen(null)} />
    </Box>
  );
}
