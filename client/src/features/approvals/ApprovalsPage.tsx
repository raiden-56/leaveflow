import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Box, Card, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Eye, FilePen, XCircle } from 'lucide-react';
import { rangesOverlap, type LeaveRequestView } from '@leaveflow/shared';
import { useApproveLeaveMutation, useDepartmentsQuery, useLeaveTypesQuery, useLeavesQuery, useRejectLeaveMutation, useRequestLeaveChangesMutation } from '@/app/store/api';
import { ConfirmDialog, DataTable, EmployeeCell, FilterSelect, HandoverStatusChip, LeaveStatusChip, LeaveTypeChip, PageHeader, ToneChip, type Column } from '@/components/common';
import { useAction, useAuth } from '@/hooks';
import { fmtDate, fmtDays } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';

type Decision = { kind: 'approve' | 'reject' | 'changes'; leave: LeaveRequestView } | null;

/** Quick client-side risk flags; the detail drawer shows the full server-side insights. */
function rowWarnings(l: LeaveRequestView, teamLeaves: LeaveRequestView[]): string[] {
  const w: string[] = [];
  if (!l.handover) w.push('No work handover');
  else if (l.handover.handoverStatus === 'PENDING_ACCEPTANCE') w.push('Handover not accepted yet');
  else if (l.handover.handoverStatus === 'DECLINED') w.push('Backup declined the handover');
  if (l.handover?.tasks.some((t) => t.priority === 'CRITICAL' && !t.assignedEmployeeId)) w.push('Critical task without owner');
  const backupAway = l.handover && teamLeaves.some((o) => o.employeeId === l.handover!.backupEmployeeId && ['APPROVED', 'PENDING'].includes(o.status) && rangesOverlap(o.startDate, o.endDate, l.startDate, l.endDate));
  if (backupAway) w.push('Backup is on leave during this period');
  const overlaps = teamLeaves.filter(
    (o) => o.leaveId !== l.leaveId && o.employeeId !== l.employeeId && o.employee?.department === l.employee?.department && ['APPROVED', 'PENDING'].includes(o.status) && rangesOverlap(o.startDate, o.endDate, l.startDate, l.endDate),
  );
  if (overlaps.length) w.push(`${overlaps.length} overlapping team leave(s)`);
  return w;
}

export default function ApprovalsPage() {
  const run = useAction();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [department, setDepartment] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [decision, setDecision] = useState<Decision>(null);
  const { data: pending, isLoading: pendingLoading, error: pendingError, refetch } = useLeavesQuery({ scope: 'approvals', status: 'PENDING', department, leaveType });
  const { data: history, isLoading: historyLoading } = useLeavesQuery({ scope: 'approvals', department, leaveType }, { skip: tab !== 'ALL' });
  const { data: teamLeaves } = useLeavesQuery({ scope: isAdmin ? 'all' : 'team' });
  const { data: departments } = useDepartmentsQuery(undefined, { skip: !isAdmin });
  const { data: types } = useLeaveTypesQuery();
  const [approve, approveState] = useApproveLeaveMutation();
  const [reject, rejectState] = useRejectLeaveMutation();
  const [changes, changesState] = useRequestLeaveChangesMutation();
  const openId = params.get('leave');

  const warnings = useMemo(() => {
    const map = new Map<string, string[]>();
    (pending ?? []).forEach((l) => map.set(l.leaveId, rowWarnings(l, teamLeaves ?? [])));
    return map;
  }, [pending, teamLeaves]);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('leave', id);
    else next.delete('leave');
    setParams(next, { replace: true });
  };

  const columns: Column<LeaveRequestView>[] = [
    {
      id: 'employee',
      label: 'Employee',
      minWidth: 210,
      sortValue: (r) => r.employee?.employeeName ?? '',
      searchValue: (r) => `${r.employee?.employeeName} ${r.leaveId}`,
      render: (r) => <EmployeeCell employee={r.employee} secondary={r.employee?.designation} />,
    },
    { id: 'department', label: 'Department', sortValue: (r) => r.employee?.department ?? '', render: (r) => r.employee?.department, hideBelow: 'xl' },
    { id: 'type', label: 'Leave Type', sortValue: (r) => r.leaveTypeName, render: (r) => <LeaveTypeChip name={r.leaveTypeName} color={r.leaveTypeColor} /> },
    { id: 'start', label: 'Start Date', sortValue: (r) => r.startDate, render: (r) => fmtDate(r.startDate) },
    { id: 'end', label: 'End Date', sortValue: (r) => r.endDate, render: (r) => fmtDate(r.endDate), hideBelow: 'xl' },
    { id: 'days', label: 'Duration', align: 'right', sortValue: (r) => r.totalDays, render: (r) => fmtDays(r.totalDays, r.halfDay) },
    { id: 'reason', label: 'Reason', searchValue: (r) => r.reason, render: (r) => <Tooltip title={r.reason}><Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>{r.reason}</Typography></Tooltip>, hideBelow: 'xl' },
    {
      id: 'backup',
      label: 'Backup Employee',
      sortValue: (r) => r.handover?.backupEmployee?.employeeName ?? '',
      searchValue: (r) => r.handover?.backupEmployee?.employeeName ?? '',
      render: (r) => r.handover?.backupEmployee?.employeeName ?? <Typography variant="body2" color="error.main">None</Typography>,
      hideBelow: 'xl',
    },
    { id: 'handover', label: 'Handover Status', sortValue: (r) => r.handover?.handoverStatus ?? '', render: (r) =>
        r.handover ? (
          <Stack spacing={0.25} alignItems="flex-start">
            <HandoverStatusChip status={r.handover.handoverStatus} />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xl: 'none' } }}>{r.handover.backupEmployee?.employeeName}</Typography>
          </Stack>
        ) : (
          <ToneChip tone="error" label="Missing" />
        ),
    },
    { id: 'applied', label: 'Applied Date', sortValue: (r) => r.appliedDate, render: (r) => fmtDate(r.appliedDate), hideBelow: 'xl' },
    {
      id: 'status',
      label: 'Status',
      sortValue: (r) => r.status,
      render: (r) => {
        const w = warnings.get(r.leaveId) ?? [];
        return (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <LeaveStatusChip status={r.status} />
            {r.status === 'PENDING' && w.length > 0 && (
              <Tooltip title={<Box>{w.map((x) => <div key={x}>• {x}</div>)}</Box>}>
                <Badge badgeContent={w.length} color="warning">
                  <AlertTriangle size={18} color="#D97706" />
                </Badge>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      hideOnCard: false,
      render: (r) => (
        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
          {r.status === 'PENDING' && (
            <>
              <Tooltip title="Approve"><IconButton size="small" color="success" onClick={() => setDecision({ kind: 'approve', leave: r })} aria-label={`Approve ${r.leaveId}`}><CheckCircle2 size={18} /></IconButton></Tooltip>
              <Tooltip title="Request changes"><IconButton size="small" color="info" onClick={() => setDecision({ kind: 'changes', leave: r })} aria-label={`Request changes ${r.leaveId}`}><FilePen size={18} /></IconButton></Tooltip>
              <Tooltip title="Reject"><IconButton size="small" color="error" onClick={() => setDecision({ kind: 'reject', leave: r })} aria-label={`Reject ${r.leaveId}`}><XCircle size={18} /></IconButton></Tooltip>
            </>
          )}
          <Tooltip title="View details & handover"><IconButton size="small" onClick={() => setOpen(r.leaveId)} aria-label={`View ${r.leaveId}`}><Eye size={18} /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  const d = decision?.leave;
  const decisionWarnings = d ? warnings.get(d.leaveId) ?? [] : [];
  const close = () => setDecision(null);

  return (
    <Box>
      <PageHeader icon={<ClipboardCheck size={22} />} title="Leave approvals" subtitle="Review requests together with their work handover before deciding." />
      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1 }}>
          <Tab value="PENDING" label={`Pending (${pending?.length ?? 0})`} />
          <Tab value="ALL" label="All requests" />
        </Tabs>
      </Card>
      <DataTable
        rows={tab === 'PENDING' ? pending : history}
        columns={columns}
        rowKey={(r) => r.leaveId}
        loading={tab === 'PENDING' ? pendingLoading : historyLoading}
        error={pendingError}
        onRetry={refetch}
        onRowClick={(r) => setOpen(r.leaveId)}
        initialSort={{ id: 'start', direction: 'asc' }}
        searchPlaceholder="Search employee, leave ID, backup…"
        toolbar={
          <>
            {isAdmin && <FilterSelect label="Department" value={department} onChange={setDepartment} options={(departments ?? []).map((x) => ({ value: x.departmentName, label: x.departmentName }))} />}
            <FilterSelect label="Leave type" value={leaveType} onChange={setLeaveType} options={(types ?? []).map((t) => ({ value: t.code, label: t.name }))} />
          </>
        }
        emptyTitle={tab === 'PENDING' ? 'No pending approvals' : 'No requests'}
        emptyDescription={tab === 'PENDING' ? 'You are all caught up. New requests from your team will appear here.' : undefined}
        emptyIcon={<CheckCircle2 size={24} />}
      />

      <ConfirmDialog
        open={decision?.kind === 'approve'}
        title={`Approve ${d?.employee?.employeeName}'s leave?`}
        description={`${d?.leaveTypeName}, ${fmtDate(d?.startDate)} → ${fmtDate(d?.endDate)} (${d ? fmtDays(d.totalDays) : ''}). Backup: ${d?.handover?.backupEmployee?.employeeName ?? 'none'}.`}
        commentLabel="Comment for the employee"
        confirmLabel="Approve"
        confirmColor="success"
        loading={approveState.isLoading}
        onClose={close}
        onConfirm={async (comment) => {
          await run(approve({ id: d!.leaveId, comment }).unwrap(), 'Leave approved');
          close();
        }}
      >
        {decisionWarnings.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'warning.main', color: '#fff' }}>
            {decisionWarnings.map((w) => <Typography key={w} variant="body2">⚠ {w}</Typography>)}
          </Stack>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={decision?.kind === 'reject'}
        title="Reject leave request"
        description={`${d?.employee?.employeeName} will be notified and the reserved days released.`}
        commentLabel="Reason for rejection"
        commentRequired
        confirmLabel="Reject"
        confirmColor="error"
        loading={rejectState.isLoading}
        onClose={close}
        onConfirm={async (comment) => {
          await run(reject({ id: d!.leaveId, comment }).unwrap(), 'Leave rejected');
          close();
        }}
      />
      <ConfirmDialog
        open={decision?.kind === 'changes'}
        title="Request changes"
        description={`${d?.employee?.employeeName} can update the dates, backup or tasks and resubmit.`}
        commentLabel="What needs to change?"
        commentRequired
        confirmLabel="Send"
        loading={changesState.isLoading}
        onClose={close}
        onConfirm={async (comment) => {
          await run(changes({ id: d!.leaveId, comment }).unwrap(), 'Change request sent');
          close();
        }}
      />
      <LeaveDetailsDrawer leaveId={openId} onClose={() => setOpen(null)} />
    </Box>
  );
}
