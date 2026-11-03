import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { BarChart3, CalendarCheck2, CalendarX2, ClipboardCheck, Hourglass, Plane, Repeat2, Users } from 'lucide-react';
import { useAdminDashboardQuery } from '@/app/store/api';
import { BarChart, ChartCard, DonutChart, foldOther } from '@/components/charts';
import { CardsSkeleton, EmployeeCell, EmptyState, ErrorState, LeaveTypeChip, PageHeader, SectionCard, StatCard } from '@/components/common';
import { useAuth } from '@/hooks';
import { palette } from '@/theme/tokens';
import { fmtMonth, fmtShort, greeting } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';
import { LeaveTable } from '../leaves/LeaveTable';

/** HR / Admin analytics dashboard — every number is computed by the API from the workbook. */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { data, isLoading, error, refetch } = useAdminDashboardQuery();
  const [leaveId, setLeaveId] = useState<string | null>(null);

  const header = (
    <PageHeader
      title={`${greeting()}, ${user?.employeeName.split(' ')[0] ?? ''}`}
      subtitle={`Organisation overview for ${settings?.organizationName ?? 'your organisation'}`}
      actions={
        <>
          <Button variant="outlined" startIcon={<Users size={16} />} onClick={() => navigate('/admin/employees')}>Employees</Button>
          <Button variant="outlined" startIcon={<BarChart3 size={16} />} onClick={() => navigate('/reports')}>Reports</Button>
          <Button variant="contained" startIcon={<ClipboardCheck size={16} />} onClick={() => navigate('/approvals')}>
            Approvals{data?.cards.pendingApprovals ? ` (${data.cards.pendingApprovals})` : ''}
          </Button>
        </>
      }
    />
  );

  if (error) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={refetch} title="Could not load the HR dashboard" />
      </>
    );
  }

  const c = data?.cards;
  const year = new Date().getFullYear();
  const cards = c
    ? [
        { label: 'Total employees', value: c.totalEmployees, icon: <Users size={20} />, color: palette.indigo, caption: 'Active headcount', onClick: () => navigate('/admin/employees') },
        { label: 'Leave days taken', value: c.totalLeavesTaken, icon: <Plane size={20} />, color: palette.teal, caption: `Approved days in ${year} to date` },
        { label: 'Pending approvals', value: c.pendingApprovals, icon: <Hourglass size={20} />, color: palette.pending, caption: 'Awaiting a decision', onClick: () => navigate('/approvals') },
        { label: 'Approved requests', value: c.approvedLeaves, icon: <CalendarCheck2 size={20} />, color: palette.approved, caption: `This year` },
        { label: 'Rejected requests', value: c.rejectedLeaves, icon: <CalendarX2 size={20} />, color: palette.rejected, caption: 'This year' },
        { label: 'On leave today', value: c.onLeaveToday, icon: <Plane size={20} />, color: palette.inProgress, caption: `${c.totalEmployees ? Math.round((c.onLeaveToday / c.totalEmployees) * 100) : 0}% of workforce`, onClick: () => navigate('/team') },
        { label: 'Handover completion', value: `${c.handoverCompletionRate}%`, icon: <Repeat2 size={20} />, color: palette.teal, caption: 'Completed vs. active + completed', progress: c.handoverCompletionRate, onClick: () => navigate('/handovers') },
      ]
    : [];

  const monthly = data?.monthlyTrend.map((m) => ({ ...m, label: fmtMonth(m.month) })) ?? [];
  const hasTrend = monthly.some((m) => m.approved + m.pending + m.rejected > 0);
  const types = foldOther((data?.typeDistribution ?? []).map((t) => ({ name: t.name, value: t.days, color: t.color })));
  const departments = data?.departmentDistribution ?? [];

  return (
    <Box>
      {header}
      {isLoading || !c ? (
        <CardsSkeleton count={4} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {cards.map((card, i) => (
            <StatCard key={card.label} index={i} {...card} />
          ))}
        </Box>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard
            title="Monthly leave trend"
            subtitle={`Leave days by month of start date, ${year}`}
            loading={isLoading}
            empty={!hasTrend}
            height={300}
          >
            <BarChart
              data={monthly}
              xKey="label"
              stacked
              series={[
                { key: 'approved', label: 'Approved', color: palette.approved },
                { key: 'pending', label: 'Pending', color: palette.pending },
                { key: 'rejected', label: 'Rejected', color: palette.rejected },
              ]}
              valueFormatter={(v) => `${v}`}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Leave type distribution" subtitle="Approved days this year" loading={isLoading} empty={types.length === 0} height={300}>
            <DonutChart data={types} legendPosition="bottom" centerLabel="days" valueFormatter={(v) => `${v}d`} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 5 }}>
          <ChartCard title="Department-wise leave" subtitle="Approved leave days per department" loading={isLoading} empty={departments.length === 0} height={260}>
            <BarChart
              data={departments.map((d) => ({ department: d.department, days: d.days }))}
              xKey="department"
              horizontal
              yWidth={120}
              series={[{ key: 'days', label: 'Leave days', color: palette.indigo }]}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <ChartCard title="Headcount" subtitle="Active employees by department" loading={isLoading} empty={departments.length === 0} height={260}>
            <DonutChart
              data={departments.map((d) => ({ name: d.department, value: d.employees, color: d.color }))}
              legendPosition="bottom"
              centerLabel="people"
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="On leave today" subtitle={`${data?.onLeaveToday.length ?? 0} employee(s)`} action={<Button size="small" onClick={() => navigate('/calendar')}>Calendar</Button>}>
            {data && data.onLeaveToday.length === 0 ? (
              <EmptyState compact title="Everyone is in today" icon={<Users size={22} />} />
            ) : (
              <Stack spacing={1.5}>
                {data?.onLeaveToday.map((e, i) => (
                  <motion.div key={e.leaveId} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setLeaveId(e.leaveId)}>
                        <EmployeeCell employee={{ employeeName: e.employeeName }} secondary={`${e.department} · back after ${fmtShort(e.endDate)}`} />
                      </Box>
                      <LeaveTypeChip name={e.leaveTypeName} color={e.color} />
                    </Stack>
                  </motion.div>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
        <Grid size={12}>
          <LeaveTable
            title={<Typography variant="h6" sx={{ mr: 1 }}>Recent leave requests</Typography>}
            rows={data?.recentRequests}
            loading={isLoading}
            showEmployee
            searchable={false}
            pageSize={8}
            onOpen={(l) => setLeaveId(l.leaveId)}
            actions={<Button size="small" onClick={() => navigate('/admin/leaves')}>View all</Button>}
          />
        </Grid>
      </Grid>
      <LeaveDetailsDrawer leaveId={leaveId} onClose={() => setLeaveId(null)} />
    </Box>
  );
}
