import type { ReactNode } from 'react';
import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Eye, FileX2 } from 'lucide-react';
import { HANDOVER_STATUS_LABELS, LEAVE_STATUS_LABELS, type LeaveRequestView } from '@leaveflow/shared';
import { DataTable, EmployeeCell, HandoverStatusChip, LeaveStatusChip, LeaveTypeChip, type Column } from '@/components/common';
import { fmtDate, fmtDays, fmtRange } from '@/utils/format';

interface LeaveTableProps {
  rows: LeaveRequestView[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onOpen: (leave: LeaveRequestView) => void;
  showEmployee?: boolean;
  showReason?: boolean;
  toolbar?: ReactNode;
  actions?: ReactNode;
  title?: ReactNode;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  bare?: boolean;
  searchable?: boolean;
}

/** Leave list used by My Leaves, Leave History, Leave Management and dashboards. */
export function LeaveTable({ rows, loading, error, onRetry, onOpen, showEmployee, showReason, toolbar, actions, title, pageSize, emptyTitle, emptyDescription, bare, searchable = true }: LeaveTableProps) {
  const columns: Column<LeaveRequestView>[] = [
    { id: 'leaveId', label: 'Leave ID', sortValue: (r) => r.leaveId, render: (r) => <Typography variant="body2" fontWeight={600} color="primary.main">{r.leaveId}</Typography>, hideOnCard: Boolean(showEmployee) },
    ...(showEmployee
      ? [{
          id: 'employee',
          label: 'Employee',
          minWidth: 200,
          sortValue: (r: LeaveRequestView) => r.employee?.employeeName ?? '',
          searchValue: (r: LeaveRequestView) => `${r.employee?.employeeName} ${r.employee?.department}`,
          render: (r: LeaveRequestView) => <EmployeeCell employee={r.employee} secondary={r.employee?.department} />,
        }]
      : []),
    { id: 'type', label: 'Leave Type', sortValue: (r) => r.leaveTypeName, render: (r) => <LeaveTypeChip name={r.leaveTypeName} color={r.leaveTypeColor} /> },
    { id: 'start', label: 'Start Date', sortValue: (r) => r.startDate, render: (r) => fmtDate(r.startDate), hideBelow: 'lg', hideOnCard: true },
    { id: 'end', label: 'End Date', sortValue: (r) => r.endDate, render: (r) => fmtDate(r.endDate), hideBelow: 'lg', hideOnCard: true },
    { id: 'range', label: 'Dates', render: (r) => fmtRange(r.startDate, r.endDate), hideBelow: 'xl' },
    { id: 'days', label: 'Days', align: 'right', sortValue: (r) => r.totalDays, render: (r) => fmtDays(r.totalDays, r.halfDay) },
    ...(showReason ? [{ id: 'reason', label: 'Reason', render: (r: LeaveRequestView) => <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{r.reason}</Typography>, searchValue: (r: LeaveRequestView) => r.reason, hideBelow: 'lg' as const }] : []),
    { id: 'applied', label: 'Applied', sortValue: (r) => r.appliedDate, render: (r) => fmtDate(r.appliedDate), hideBelow: 'md' },
    { id: 'status', label: 'Status', sortValue: (r) => r.status, searchValue: (r) => LEAVE_STATUS_LABELS[r.status], render: (r) => <LeaveStatusChip status={r.status} /> },
    {
      id: 'approver',
      label: 'Approved By',
      hideBelow: 'xl',
      sortValue: (r) => r.approver?.employeeName ?? '',
      render: (r) =>
        r.status === 'APPROVED' || r.status === 'REJECTED' ? (
          <Stack>
            <Typography variant="body2">{r.approver?.employeeName ?? '—'}</Typography>
            {r.rejectionReason && <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 180 }}>{r.rejectionReason}</Typography>}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        ),
    },
    {
      id: 'handover',
      label: 'Handover',
      sortValue: (r) => r.handover?.handoverStatus ?? '',
      searchValue: (r) => (r.handover ? `${HANDOVER_STATUS_LABELS[r.handover.handoverStatus]} ${r.handover.backupEmployee?.employeeName}` : ''),
      hideBelow: 'lg',
      render: (r) => (r.handover ? <HandoverStatusChip status={r.handover.handoverStatus} /> : <Typography variant="body2" color="text.secondary">None</Typography>),
    },
    {
      id: 'actions',
      label: '',
      align: 'right',
      hideOnCard: true,
      render: (r) => (
        <Tooltip title="View details">
          <IconButton size="small" onClick={() => onOpen(r)} aria-label={`View ${r.leaveId}`}>
            <Eye size={17} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.leaveId}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={onOpen}
      toolbar={toolbar}
      actions={actions}
      title={title}
      pageSize={pageSize}
      bare={bare}
      searchable={searchable}
      searchPlaceholder="Search leave ID, type, reason…"
      emptyTitle={emptyTitle ?? 'No leave requests'}
      emptyDescription={emptyDescription}
      emptyIcon={<FileX2 size={24} />}
    />
  );
}

export function ViewAllButton({ onClick, label = 'View all' }: { onClick: () => void; label?: string }) {
  return <Button size="small" onClick={onClick}>{label}</Button>;
}
