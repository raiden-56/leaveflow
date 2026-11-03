import { useMemo, useState } from 'react';
import { Box, Button, Card, Grid, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { BarChart3, CalendarCheck2, CalendarX2, Download, FileSpreadsheet, Hourglass, ListChecks, Repeat2 } from 'lucide-react';
import {
  HANDOVER_STATUSES,
  HANDOVER_STATUS_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  dayjs,
  type ReportFilters,
  type WorkHandoverView,
} from '@leaveflow/shared';
import { useDepartmentSummaryQuery, useDepartmentsQuery, useHandoverSummaryQuery, useHandoversQuery, useLeaveSummaryQuery } from '@/app/store/api';
import { AreaChart, BarChart, ChartCard, DonutChart, LineChart, PieChart, foldOther } from '@/components/charts';
import { CardsSkeleton, DataTable, EmployeeCell, ErrorState, FilterSelect, HandoverStatusChip, LoadingButton, PageHeader, PriorityChip, StatCard, type Column } from '@/components/common';
import { reportRepository } from '@/services/repositories';
import { useAction, useAuth, useToday } from '@/hooks';
import { handoverStatusTone, palette, taskStatusTone, toneColor } from '@/theme/tokens';
import { exportCsv, fmtMonth, fmtRange } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';
import { LeaveTable } from '../leaves/LeaveTable';

type Preset = 'month' | 'quarter' | 'year' | 'lastYear' | 'custom';
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'custom', label: 'Custom range' },
];

function presetRange(preset: Preset, today: string): { from: string; to: string } {
  const t = dayjs(today);
  switch (preset) {
    case 'month':
      return { from: t.startOf('month').format('YYYY-MM-DD'), to: t.endOf('month').format('YYYY-MM-DD') };
    case 'quarter': {
      const qStart = t.month(Math.floor(t.month() / 3) * 3).startOf('month');
      return { from: qStart.format('YYYY-MM-DD'), to: qStart.add(2, 'month').endOf('month').format('YYYY-MM-DD') };
    }
    case 'lastYear':
      return { from: `${t.year() - 1}-01-01`, to: `${t.year() - 1}-12-31` };
    default:
      return { from: `${t.year()}-01-01`, to: `${t.year()}-12-31` };
  }
}

const TABS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
  { value: 'employees', label: 'Employee-wise' },
  { value: 'departments', label: 'Department-wise' },
  { value: 'types', label: 'Leave types' },
  { value: 'pending', label: 'Pending approvals' },
  { value: 'handovers', label: 'Work handovers' },
  { value: 'completion', label: 'Handover completion' },
] as const;
type TabValue = (typeof TABS)[number]['value'];

const csvButton = (onClick: () => void) => (
  <Button size="small" startIcon={<Download size={15} />} onClick={onClick}>CSV</Button>
);

/** HR / manager reporting: leave and handover analytics for a date range, with Excel and CSV export. */
export default function ReportsPage() {
  const today = useToday();
  const run = useAction();
  const { isAdmin } = useAuth();
  const [preset, setPreset] = useState<Preset>('year');
  const [custom, setCustom] = useState(() => presetRange('year', today));
  const [department, setDepartment] = useState('');
  const [tab, setTab] = useState<TabValue>('monthly');
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const invalidRange = range.from > range.to;
  const filters: ReportFilters = { ...range, department: department || undefined };
  const year = Number(range.from.slice(0, 4));
  const annualFilters: ReportFilters = { from: `${year}-01-01`, to: `${year}-12-31`, department: department || undefined };

  const summary = useLeaveSummaryQuery(filters, { skip: invalidRange });
  const annual = useLeaveSummaryQuery(annualFilters, { skip: tab !== 'annual' });
  const depts = useDepartmentSummaryQuery(filters, { skip: invalidRange });
  const handovers = useHandoverSummaryQuery(filters, { skip: invalidRange });
  const handoverList = useHandoversQuery({ scope: isAdmin ? 'all' : 'team', from: range.from, to: range.to }, { skip: tab !== 'handovers' || invalidRange });
  const { data: departments } = useDepartmentsQuery();

  const s = summary.data;
  const h = handovers.data;
  const monthly = (s?.byMonth ?? []).map((m) => ({ ...m, label: fmtMonth(m.month) }));
  const annualMonthly = (annual.data?.byMonth ?? []).map((m) => ({ ...m, label: fmtMonth(m.month) }));
  const cumulative = useMemo(() => {
    let acc = 0;
    return annualMonthly.map((m) => ({ label: m.label, cumulative: (acc += m.days) }));
  }, [annualMonthly]);

  const handoverRows = (handoverList.data ?? []).filter((x) => !department || x.employee?.department === department);
  const handoverColumns: Column<WorkHandoverView>[] = [
    { id: 'id', label: 'ID', sortValue: (r) => r.handoverId, render: (r) => r.handoverId, hideBelow: 'lg' },
    { id: 'title', label: 'Handover', sortValue: (r) => r.handoverTitle, render: (r) => <Typography variant="body2" fontWeight={600}>{r.handoverTitle}</Typography> },
    { id: 'emp', label: 'Employee', sortValue: (r) => r.employee?.employeeName ?? '', render: (r) => <EmployeeCell employee={r.employee} secondary={r.employee?.department} size={28} /> },
    { id: 'backup', label: 'Backup', sortValue: (r) => r.backupEmployee?.employeeName ?? '', render: (r) => <EmployeeCell employee={r.backupEmployee} size={28} /> },
    { id: 'period', label: 'Period', sortValue: (r) => r.startDate, render: (r) => fmtRange(r.startDate, r.endDate), hideBelow: 'md' },
    { id: 'priority', label: 'Priority', sortValue: (r) => r.priority, render: (r) => <PriorityChip priority={r.priority} />, hideBelow: 'lg' },
    { id: 'status', label: 'Status', sortValue: (r) => r.handoverStatus, searchValue: (r) => HANDOVER_STATUS_LABELS[r.handoverStatus], render: (r) => <HandoverStatusChip status={r.handoverStatus} /> },
    { id: 'tasks', label: 'Tasks done', align: 'right', sortValue: (r) => r.completionStatus, render: (r) => `${r.tasks.filter((t) => t.taskStatus === 'COMPLETED').length}/${r.tasks.length} (${r.completionStatus}%)` },
  ];

  const exportExcel = async () => {
    setExporting(true);
    await run(reportRepository.exportExcel(filters), 'Report downloaded');
    setExporting(false);
  };

  const loading = summary.isLoading || depts.isLoading || handovers.isLoading;
  const error = summary.error || depts.error || handovers.error;

  return (
    <Box>
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Leave and handover analytics · ${fmtRange(range.from, range.to)}`}
        icon={<BarChart3 size={22} />}
        actions={
          <LoadingButton variant="contained" startIcon={<FileSpreadsheet size={16} />} loading={exporting} disabled={invalidRange} onClick={exportExcel}>
            Export Excel
          </LoadingButton>
        }
      />

      <Card sx={{ p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
          <TextField select label="Period" value={preset} onChange={(e) => setPreset(e.target.value as Preset)} sx={{ minWidth: 170 }}>
            {PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </TextField>
          <TextField type="date" label="From" value={range.from} disabled={preset !== 'custom'} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} error={invalidRange} />
          <TextField type="date" label="To" value={range.to} disabled={preset !== 'custom'} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} error={invalidRange} helperText={invalidRange ? 'End date is before start date' : undefined} />
          {isAdmin && (
            <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="All departments" minWidth={190} options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
          )}
        </Stack>
      </Card>

      {error && <ErrorState error={error} onRetry={() => { summary.refetch(); depts.refetch(); handovers.refetch(); }} />}

      {loading || !s || !h ? (
        <CardsSkeleton count={4} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' } }}>
          <StatCard index={0} label="Requests" value={s.totals.requests} icon={<ListChecks size={20} />} color={palette.indigo} caption="In period" />
          <StatCard index={1} label="Approved days" value={s.totals.days} icon={<CalendarCheck2 size={20} />} color={palette.approved} caption={`${s.totals.approved} approved requests`} />
          <StatCard index={2} label="Pending" value={s.totals.pending} icon={<Hourglass size={20} />} color={palette.pending} caption="Awaiting decision" />
          <StatCard index={3} label="Rejected" value={s.totals.rejected} icon={<CalendarX2 size={20} />} color={palette.rejected} caption={`${s.totals.cancelled} cancelled`} />
          <StatCard index={4} label="Handover completion" value={`${h.completionRate}%`} icon={<Repeat2 size={20} />} color={palette.teal} progress={h.completionRate} />
          <StatCard index={5} label="Overdue tasks" value={h.overdueTasks} icon={<ListChecks size={20} />} color={palette.rejected} caption="Open handovers" />
        </Box>
      )}

      <Card sx={{ mt: 2.5, mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ px: 1 }}>
          {TABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
        </Tabs>
      </Card>

      {tab === 'monthly' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <ChartCard title="Requests by month" subtitle="By month of leave start" loading={summary.isLoading} empty={!monthly.some((m) => m.approved + m.pending + m.rejected)}>
              <BarChart data={monthly} xKey="label" stacked series={[{ key: 'approved', label: 'Approved', color: palette.approved }, { key: 'pending', label: 'Pending', color: palette.pending }, { key: 'rejected', label: 'Rejected', color: palette.rejected }]} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <ChartCard title="Approved leave days" subtitle="Per month" loading={summary.isLoading} empty={!monthly.some((m) => m.days)}>
              <LineChart data={monthly} xKey="label" series={[{ key: 'days', label: 'Approved days', color: palette.indigo }]} />
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <DataTable
              title={<Typography variant="h6">Monthly leave report</Typography>}
              rows={monthly}
              rowKey={(r) => r.month}
              searchable={false}
              pageSize={12}
              loading={summary.isLoading}
              actions={csvButton(() => exportCsv('monthly-leave-report', monthly, [{ header: 'Month', value: (r) => r.month }, { header: 'Approved', value: (r) => r.approved }, { header: 'Pending', value: (r) => r.pending }, { header: 'Rejected', value: (r) => r.rejected }, { header: 'Approved days', value: (r) => r.days }]))}
              columns={[
                { id: 'month', label: 'Month', sortValue: (r) => r.month, render: (r) => dayjs(`${r.month}-01`).format('MMMM YYYY') },
                { id: 'approved', label: 'Approved', align: 'right', sortValue: (r) => r.approved, render: (r) => r.approved },
                { id: 'pending', label: 'Pending', align: 'right', sortValue: (r) => r.pending, render: (r) => r.pending },
                { id: 'rejected', label: 'Rejected', align: 'right', sortValue: (r) => r.rejected, render: (r) => r.rejected },
                { id: 'days', label: 'Approved days', align: 'right', sortValue: (r) => r.days, render: (r) => <b>{r.days}</b> },
              ]}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'annual' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title={`Leave days in ${year}`} subtitle="Approved days per month" loading={annual.isLoading} empty={!annualMonthly.some((m) => m.days)}>
              <AreaChart data={annualMonthly} xKey="label" series={[{ key: 'days', label: 'Approved days', color: palette.teal }]} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Cumulative leave days" subtitle={`Running total through ${year}`} loading={annual.isLoading} empty={!annualMonthly.some((m) => m.days)}>
              <AreaChart data={cumulative} xKey="label" series={[{ key: 'cumulative', label: 'Cumulative days', color: palette.indigo }]} />
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <DataTable
              title={<Typography variant="h6">Annual summary by leave type · {year}</Typography>}
              rows={annual.data?.byType}
              rowKey={(r) => r.leaveType}
              loading={annual.isLoading}
              searchable={false}
              actions={csvButton(() => exportCsv(`annual-leave-${year}`, annual.data?.byType ?? [], [{ header: 'Leave type', value: (r) => r.name }, { header: 'Requests', value: (r) => r.requests }, { header: 'Approved days', value: (r) => r.days }]))}
              columns={[
                { id: 'name', label: 'Leave type', sortValue: (r) => r.name, render: (r) => <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: r.color }} /><span>{r.name}</span></Stack> },
                { id: 'requests', label: 'Requests', align: 'right', sortValue: (r) => r.requests, render: (r) => r.requests },
                { id: 'days', label: 'Approved days', align: 'right', sortValue: (r) => r.days, render: (r) => <b>{r.days}</b> },
              ]}
              emptyTitle={`No leave recorded in ${year}`}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'employees' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <ChartCard title="Top 10 by approved days" loading={summary.isLoading} empty={!s?.byEmployee.length} height={360}>
              <BarChart data={(s?.byEmployee ?? []).slice(0, 10).map((e) => ({ name: e.employeeName, days: e.days }))} xKey="name" horizontal yWidth={130} series={[{ key: 'days', label: 'Approved days', color: palette.indigo }]} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <DataTable
              title={<Typography variant="h6">Employee-wise leave</Typography>}
              rows={s?.byEmployee}
              rowKey={(r) => r.employeeId}
              loading={summary.isLoading}
              initialSort={{ id: 'days', direction: 'desc' }}
              actions={csvButton(() => exportCsv('employee-leave-report', s?.byEmployee ?? [], [{ header: 'Employee ID', value: (r) => r.employeeId }, { header: 'Employee', value: (r) => r.employeeName }, { header: 'Department', value: (r) => r.department }, { header: 'Requests', value: (r) => r.requests }, { header: 'Approved days', value: (r) => r.days }]))}
              columns={[
                { id: 'emp', label: 'Employee', sortValue: (r) => r.employeeName, render: (r) => <EmployeeCell employee={{ employeeName: r.employeeName }} secondary={r.employeeId} size={28} /> },
                { id: 'dept', label: 'Department', sortValue: (r) => r.department, render: (r) => r.department },
                { id: 'requests', label: 'Requests', align: 'right', sortValue: (r) => r.requests, render: (r) => r.requests },
                { id: 'days', label: 'Approved days', align: 'right', sortValue: (r) => r.days, render: (r) => <b>{r.days}</b> },
              ]}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'departments' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Approved days by department" loading={depts.isLoading} empty={!depts.data?.departments.length}>
              <BarChart data={(depts.data?.departments ?? []).map((d) => ({ department: d.department, days: d.days }))} xKey="department" series={[{ key: 'days', label: 'Approved days', color: palette.indigo }]} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Average days per employee" loading={depts.isLoading} empty={!depts.data?.departments.length}>
              <BarChart data={(depts.data?.departments ?? []).map((d) => ({ department: d.department, avg: d.averageDaysPerEmployee }))} xKey="department" series={[{ key: 'avg', label: 'Avg days / employee', color: palette.teal }]} />
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <DataTable
              title={<Typography variant="h6">Department-wise leave</Typography>}
              rows={depts.data?.departments}
              rowKey={(r) => r.department}
              loading={depts.isLoading}
              searchable={false}
              actions={csvButton(() => exportCsv('department-leave-report', depts.data?.departments ?? [], [{ header: 'Department', value: (r) => r.department }, { header: 'Employees', value: (r) => r.employees }, { header: 'Requests', value: (r) => r.requests }, { header: 'Approved days', value: (r) => r.days }, { header: 'Avg days per employee', value: (r) => r.averageDaysPerEmployee }, { header: 'On leave today', value: (r) => r.onLeaveToday }]))}
              columns={[
                { id: 'dept', label: 'Department', sortValue: (r) => r.department, render: (r) => <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: r.color }} /><b>{r.department}</b></Stack> },
                { id: 'employees', label: 'Employees', align: 'right', sortValue: (r) => r.employees, render: (r) => r.employees },
                { id: 'requests', label: 'Requests', align: 'right', sortValue: (r) => r.requests, render: (r) => r.requests },
                { id: 'days', label: 'Approved days', align: 'right', sortValue: (r) => r.days, render: (r) => r.days },
                { id: 'avg', label: 'Avg / employee', align: 'right', sortValue: (r) => r.averageDaysPerEmployee, render: (r) => r.averageDaysPerEmployee },
                { id: 'today', label: 'On leave today', align: 'right', sortValue: (r) => r.onLeaveToday, render: (r) => r.onLeaveToday },
              ]}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'types' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Leave type distribution" subtitle="Share of approved days" loading={summary.isLoading} empty={!s?.byType.some((t) => t.days)} height={300}>
              <PieChart data={foldOther((s?.byType ?? []).map((t) => ({ name: t.name, value: t.days, color: t.color })))} valueFormatter={(v) => `${v}d`} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title="Requests by leave type" subtitle="All statuses" loading={summary.isLoading} empty={!s?.byType.length} height={300}>
              <DonutChart data={foldOther((s?.byType ?? []).map((t) => ({ name: t.name, value: t.requests, color: t.color })))} centerLabel="requests" />
            </ChartCard>
          </Grid>
        </Grid>
      )}

      {tab === 'pending' && (
        <LeaveTable
          title={<Typography variant="h6">Pending approval report</Typography>}
          rows={s?.pending}
          loading={summary.isLoading}
          showEmployee
          showReason
          onOpen={(l) => setLeaveId(l.leaveId)}
          emptyTitle="No pending approvals in this period"
          actions={csvButton(() =>
            exportCsv('pending-approvals', s?.pending ?? [], [
              { header: 'Leave ID', value: (r) => r.leaveId },
              { header: 'Employee', value: (r) => r.employee?.employeeName },
              { header: 'Department', value: (r) => r.employee?.department },
              { header: 'Type', value: (r) => r.leaveTypeName },
              { header: 'Start', value: (r) => r.startDate },
              { header: 'End', value: (r) => r.endDate },
              { header: 'Days', value: (r) => r.totalDays },
              { header: 'Applied', value: (r) => r.appliedDate },
              { header: 'Approver', value: (r) => r.approver?.employeeName },
              { header: 'Handover', value: (r) => (r.handover ? HANDOVER_STATUS_LABELS[r.handover.handoverStatus] : 'None') },
            ]),
          )}
        />
      )}

      {tab === 'handovers' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="Handovers by status" loading={handovers.isLoading} empty={!h || HANDOVER_STATUSES.every((st) => !h.totals[st])}>
              <DonutChart
                data={HANDOVER_STATUSES.filter((st) => h?.totals[st]).map((st) => ({ name: HANDOVER_STATUS_LABELS[st], value: h!.totals[st], color: toneColor[handoverStatusTone[st]] }))}
                centerLabel="handovers"
              />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="Handover tasks by status" loading={handovers.isLoading} empty={!h || TASK_STATUSES.every((st) => !h.taskTotals[st])}>
              <BarChart
                data={TASK_STATUSES.map((st) => ({ status: TASK_STATUS_LABELS[st], count: h?.taskTotals[st] ?? 0, color: toneColor[taskStatusTone[st]] }))}
                xKey="status"
                series={[{ key: 'count', label: 'Tasks', color: palette.indigo }]}
              />
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <DataTable
              title={<Typography variant="h6">Work handover report</Typography>}
              rows={handoverRows}
              rowKey={(r) => r.handoverId}
              columns={handoverColumns}
              loading={handoverList.isLoading}
              error={handoverList.error}
              onRetry={handoverList.refetch}
              emptyTitle="No handovers in this period"
              actions={csvButton(() =>
                exportCsv('work-handovers', handoverRows, [
                  { header: 'Handover ID', value: (r) => r.handoverId },
                  { header: 'Leave ID', value: (r) => r.leaveId },
                  { header: 'Title', value: (r) => r.handoverTitle },
                  { header: 'Employee', value: (r) => r.employee?.employeeName },
                  { header: 'Backup', value: (r) => r.backupEmployee?.employeeName },
                  { header: 'Start', value: (r) => r.startDate },
                  { header: 'End', value: (r) => r.endDate },
                  { header: 'Priority', value: (r) => r.priority },
                  { header: 'Status', value: (r) => HANDOVER_STATUS_LABELS[r.handoverStatus] },
                  { header: 'Tasks', value: (r) => r.tasks.length },
                  { header: 'Completion %', value: (r) => r.completionStatus },
                ]),
              )}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'completion' && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <ChartCard title="Handovers created vs completed" subtitle="Per month" loading={handovers.isLoading} empty={!h?.byMonth.some((m) => m.created + m.completed)}>
              <LineChart data={(h?.byMonth ?? []).map((m) => ({ ...m, label: fmtMonth(m.month) }))} xKey="label" series={[{ key: 'created', label: 'Created', color: palette.indigo }, { key: 'completed', label: 'Completed', color: palette.teal }]} />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <ChartCard title="Completion rate" subtitle="Completed ÷ (active + completed)" loading={handovers.isLoading} empty={!h || h.totals.ACTIVE + h.totals.COMPLETED === 0}>
              <DonutChart
                data={[{ name: 'Completed', value: h?.totals.COMPLETED ?? 0, color: palette.approved }, { name: 'Active', value: h?.totals.ACTIVE ?? 0, color: palette.inProgress }]}
                centerValue={`${h?.completionRate ?? 0}%`}
                centerLabel="completed"
              />
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <DataTable
              title={<Typography variant="h6">Backup employee completion</Typography>}
              rows={h?.byBackup}
              rowKey={(r) => r.employeeId}
              loading={handovers.isLoading}
              initialSort={{ id: 'handovers', direction: 'desc' }}
              actions={csvButton(() => exportCsv('handover-completion', h?.byBackup ?? [], [{ header: 'Backup employee', value: (r) => r.employeeName }, { header: 'Handovers', value: (r) => r.handovers }, { header: 'Tasks', value: (r) => r.tasks }, { header: 'Completed tasks', value: (r) => r.completedTasks }, { header: 'Task completion %', value: (r) => (r.tasks ? Math.round((r.completedTasks / r.tasks) * 100) : 0) }]))}
              columns={[
                { id: 'emp', label: 'Backup employee', sortValue: (r) => r.employeeName, render: (r) => <EmployeeCell employee={{ employeeName: r.employeeName }} secondary={r.employeeId} size={28} /> },
                { id: 'handovers', label: 'Handovers', align: 'right', sortValue: (r) => r.handovers, render: (r) => r.handovers },
                { id: 'tasks', label: 'Tasks', align: 'right', sortValue: (r) => r.tasks, render: (r) => r.tasks },
                { id: 'done', label: 'Completed', align: 'right', sortValue: (r) => r.completedTasks, render: (r) => r.completedTasks },
                { id: 'rate', label: 'Completion', align: 'right', sortValue: (r) => (r.tasks ? r.completedTasks / r.tasks : 0), render: (r) => <b>{r.tasks ? Math.round((r.completedTasks / r.tasks) * 100) : 0}%</b> },
              ]}
            />
          </Grid>
        </Grid>
      )}

      <LeaveDetailsDrawer leaveId={leaveId} onClose={() => setLeaveId(null)} />
    </Box>
  );
}
