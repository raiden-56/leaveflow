import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Card, Tab, Tabs, TextField } from '@mui/material';
import { ClipboardList, FileDown, FileSpreadsheet } from 'lucide-react';
import { HANDOVER_STATUS_LABELS, LEAVE_STATUS_LABELS } from '@leaveflow/shared';
import { useDepartmentsQuery, useLeavesQuery, useLeaveTypesQuery } from '@/app/store/api';
import { FilterSelect, LoadingButton, PageHeader, optionsFrom } from '@/components/common';
import { useAction } from '@/hooks';
import { leaveRepository, type LeaveQuery } from '@/services/repositories';
import { exportCsv } from '@/utils/format';
import { BalancesPanel } from '../leave-balances/BalancesPanel';
import { LeaveDetailsDrawer } from './LeaveDetailsDrawer';
import { LeaveTable } from './LeaveTable';

function AllRequests() {
  const run = useAction();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const query: LeaveQuery = { scope: 'all', status, leaveType, department, from, to };
  const { data, isLoading, isFetching, error, refetch } = useLeavesQuery(query);
  const { data: types } = useLeaveTypesQuery();
  const { data: departments } = useDepartmentsQuery();
  const selected = params.get('leave');

  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('leave', id);
    else next.delete('leave');
    setParams(next, { replace: true });
  };

  return (
    <>
      <LeaveTable
        rows={data}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        onOpen={(l) => setSelected(l.leaveId)}
        showEmployee
        showReason
        emptyTitle="No leave requests match these filters"
        toolbar={
          <>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={optionsFrom(LEAVE_STATUS_LABELS)} minWidth={140} />
            <FilterSelect label="Leave type" value={leaveType} onChange={setLeaveType} options={(types ?? []).map((t) => ({ value: t.code, label: t.name }))} />
            <FilterSelect label="Department" value={department} onChange={setDepartment} options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
            <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
            <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 150 }} />
          </>
        }
        actions={
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDown size={15} />}
              disabled={!data?.length}
              onClick={() =>
                exportCsv('leave-requests', data ?? [], [
                  { header: 'Leave ID', value: (r) => r.leaveId },
                  { header: 'Employee', value: (r) => r.employee?.employeeName },
                  { header: 'Department', value: (r) => r.employee?.department },
                  { header: 'Leave type', value: (r) => r.leaveTypeName },
                  { header: 'Start', value: (r) => r.startDate },
                  { header: 'End', value: (r) => r.endDate },
                  { header: 'Days', value: (r) => r.totalDays },
                  { header: 'Applied', value: (r) => r.appliedDate },
                  { header: 'Status', value: (r) => LEAVE_STATUS_LABELS[r.status] },
                  { header: 'Approved by', value: (r) => r.approver?.employeeName },
                  { header: 'Rejection reason', value: (r) => r.rejectionReason },
                  { header: 'Backup', value: (r) => r.handover?.backupEmployee?.employeeName },
                  { header: 'Handover status', value: (r) => (r.handover ? HANDOVER_STATUS_LABELS[r.handover.handoverStatus] : '') },
                  { header: 'Reason', value: (r) => r.reason },
                ])
              }
            >
              CSV
            </Button>
            <LoadingButton
              variant="outlined"
              size="small"
              startIcon={<FileSpreadsheet size={15} />}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                await run(leaveRepository.exportExcel(query), 'Excel export downloaded');
                setExporting(false);
              }}
            >
              Excel
            </LoadingButton>
          </>
        }
      />
      <LeaveDetailsDrawer leaveId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function LeaveManagementPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'balances' ? 'balances' : 'requests';
  return (
    <>
      <PageHeader title="Leave Management" icon={<ClipboardList size={22} />} subtitle="Every leave request in the organisation and employee leave balances." />
      <Card sx={{ mb: 2.5, px: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => {
            const next = new URLSearchParams();
            if (v === 'balances') next.set('tab', 'balances');
            setParams(next, { replace: true });
          }}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value="requests" label="All requests" />
          <Tab value="balances" label="Leave balances" />
        </Tabs>
      </Card>
      <Box>{tab === 'requests' ? <AllRequests /> : <BalancesPanel />}</Box>
    </>
  );
}
