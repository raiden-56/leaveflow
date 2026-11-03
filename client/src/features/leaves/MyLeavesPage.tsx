import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Card, LinearProgress, Menu, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { CalendarPlus, Download, FileClock, FileSpreadsheet, FileText } from 'lucide-react';
import { HANDOVER_STATUS_LABELS, HALF_DAY_LABELS, LEAVE_STATUS_LABELS, type LeaveStatus } from '@leaveflow/shared';
import { useLeaveTypesQuery, useLeavesQuery, useMyBalancesQuery } from '@/app/store/api';
import { FilterSelect, PageHeader } from '@/components/common';
import { useAction, useAuth } from '@/hooks';
import { leaveRepository } from '@/services/repositories';
import { exportCsv } from '@/utils/format';
import { LeaveDetailsDrawer } from './LeaveDetailsDrawer';
import { LeaveTable } from './LeaveTable';

const TABS: { value: '' | LeaveStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** Personal leave history with filters, balance overview and CSV/Excel export. */
export default function MyLeavesPage() {
  const navigate = useNavigate();
  const run = useAction();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'' | LeaveStatus>('');
  const [leaveType, setLeaveType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const filters = { scope: 'mine' as const, status, leaveType, from, to };
  const { data, isLoading, isFetching, error, refetch } = useLeavesQuery(filters);
  const { data: all } = useLeavesQuery({ scope: 'mine' });
  const { data: types } = useLeaveTypesQuery();
  const { data: balances } = useMyBalancesQuery({ employeeId: user?.employeeId ?? '' }, { skip: !user });
  const openId = params.get('leave');
  const counts = useMemo(() => {
    const c: Record<string, number> = { '': all?.length ?? 0 };
    all?.forEach((l) => (c[l.status] = (c[l.status] ?? 0) + 1));
    return c;
  }, [all]);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('leave', id);
    else next.delete('leave');
    setParams(next, { replace: true });
  };

  const csv = () => {
    exportCsv('my-leaves', data ?? [], [
      { header: 'Leave ID', value: (r) => r.leaveId },
      { header: 'Leave Type', value: (r) => r.leaveTypeName },
      { header: 'Start Date', value: (r) => r.startDate },
      { header: 'End Date', value: (r) => r.endDate },
      { header: 'Duration (days)', value: (r) => r.totalDays },
      { header: 'Session', value: (r) => HALF_DAY_LABELS[r.halfDay] },
      { header: 'Applied Date', value: (r) => r.appliedDate },
      { header: 'Status', value: (r) => LEAVE_STATUS_LABELS[r.status] },
      { header: 'Approved By', value: (r) => (r.status === 'APPROVED' ? r.approver?.employeeName : '') },
      { header: 'Rejection Reason', value: (r) => r.rejectionReason },
      { header: 'Backup', value: (r) => r.handover?.backupEmployee?.employeeName },
      { header: 'Handover Status', value: (r) => (r.handover ? HANDOVER_STATUS_LABELS[r.handover.handoverStatus] : '') },
      { header: 'Reason', value: (r) => r.reason },
    ]);
    setExportAnchor(null);
  };

  // Event-based entitlements (maternity, bereavement…) only show once they've been used.
  const tracked = (balances ?? []).filter((b) => b.trackBalance && ((b.includeInTotals && b.total > 0) || b.used > 0 || b.pending > 0));

  return (
    <Box>
      <PageHeader
        icon={<FileClock size={22} />}
        title="My leaves"
        subtitle="Your complete leave history, balances and handover status."
        actions={
          <Button variant="contained" startIcon={<CalendarPlus size={18} />} onClick={() => navigate('/apply-leave')}>
            Apply leave
          </Button>
        }
      />

      {tracked.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1.5, mb: 3, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', xl: 'repeat(6, 1fr)' } }}>
          {tracked.map((b, i) => (
            <motion.div key={b.balanceId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card sx={{ p: 1.75 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.color }} />
                  <Typography variant="caption" color="text.secondary" noWrap>{b.leaveTypeName}</Typography>
                </Stack>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                  {b.available}
                  <Typography component="span" variant="caption" color="text.secondary"> / {b.total}</Typography>
                </Typography>
                <Tooltip title={`${b.used} used · ${b.pending} pending`}>
                  <LinearProgress variant="determinate" value={b.total ? ((b.used + b.pending) / b.total) * 100 : 0} sx={{ mt: 1, height: 5, '& .MuiLinearProgress-bar': { bgcolor: b.color } }} />
                </Tooltip>
              </Card>
            </motion.div>
          ))}
        </Box>
      )}

      <Card sx={{ mb: 2 }}>
        <Tabs value={status} onChange={(_, v) => setStatus(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 1 }}>
          {TABS.map((t) => (
            <Tab key={t.value} value={t.value} label={`${t.label}${counts[t.value] ? ` (${counts[t.value]})` : ''}`} />
          ))}
        </Tabs>
      </Card>
      {isFetching && !isLoading && <LinearProgress sx={{ height: 2, mb: -0.25 }} />}
      <LeaveTable
        rows={data}
        loading={isLoading}
        error={error}
        onRetry={refetch}
        onOpen={(l) => setOpen(l.leaveId)}
        showReason
        toolbar={
          <>
            <FilterSelect label="Leave type" value={leaveType} onChange={setLeaveType} options={(types ?? []).map((t) => ({ value: t.code, label: t.name }))} />
            <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            {(leaveType || from || to) && <Button size="small" onClick={() => { setLeaveType(''); setFrom(''); setTo(''); }}>Clear</Button>}
          </>
        }
        actions={
          <>
            <Button variant="outlined" startIcon={<Download size={16} />} onClick={(e) => setExportAnchor(e.currentTarget)} disabled={!data?.length}>
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
              <MenuItem onClick={csv}><FileText size={16} style={{ marginRight: 8 }} /> CSV</MenuItem>
              <MenuItem onClick={() => { setExportAnchor(null); void run(leaveRepository.exportExcel(filters), 'Excel export downloaded'); }}>
                <FileSpreadsheet size={16} style={{ marginRight: 8 }} /> Excel (.xlsx)
              </MenuItem>
            </Menu>
          </>
        }
        emptyDescription="Leave you apply for will be listed here with its approval and handover status."
      />
      <LeaveDetailsDrawer leaveId={openId} onClose={() => setOpen(null)} />
    </Box>
  );
}
