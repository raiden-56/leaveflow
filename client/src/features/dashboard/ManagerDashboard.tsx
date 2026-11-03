import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Grid, IconButton, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, CalendarOff, CheckCircle2, ClipboardCheck, Eye, Repeat2, UserRoundCheck, Users } from 'lucide-react';
import type { LeaveRequestView, TeamMemberAvailability } from '@leaveflow/shared';
import { useManagerDashboardQuery } from '@/app/store/api';
import { CardsSkeleton, DataTable, EmployeeCell, ErrorState, HandoverStatusChip, LeaveTypeChip, SectionCard, StatCard, ToneChip, type Column } from '@/components/common';
import { palette } from '@/theme/tokens';
import { fmtDays, fmtMonth, fmtRange } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';
import { TeamCalendarCard, UpcomingLeaveList, WelcomeBanner } from './widgets';

const STATUS_TONE = { AVAILABLE: 'success', ON_LEAVE: 'error', REMOTE: 'info' } as const;
const STATUS_LABEL = { AVAILABLE: 'Available', ON_LEAVE: 'On leave', REMOTE: 'Remote' } as const;

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data, isLoading, error, refetch } = useManagerDashboardQuery();
  const [leaveId, setLeaveId] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const approvalColumns: Column<LeaveRequestView>[] = [
    { id: 'employee', label: 'Employee', minWidth: 190, sortValue: (r) => r.employee?.employeeName ?? '', render: (r) => <EmployeeCell employee={r.employee} /> },
    { id: 'type', label: 'Type', render: (r) => <LeaveTypeChip name={r.leaveTypeName} color={r.leaveTypeColor} /> },
    { id: 'dates', label: 'Dates', sortValue: (r) => r.startDate, render: (r) => `${fmtRange(r.startDate, r.endDate)} · ${fmtDays(r.totalDays)}` },
    {
      id: 'handover',
      label: 'Backup',
      hideBelow: 'lg',
      render: (r) =>
        r.handover ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" noWrap>{r.handover.backupEmployee?.employeeName}</Typography>
            <HandoverStatusChip status={r.handover.handoverStatus} />
          </Stack>
        ) : (
          <ToneChip tone="error" label="No handover" />
        ),
    },
    { id: 'actions', label: '', align: 'right', hideOnCard: true, render: (r) => <Tooltip title="Review"><IconButton size="small" onClick={() => setLeaveId(r.leaveId)}><Eye size={17} /></IconButton></Tooltip> },
  ];

  const workloadColumns: Column<TeamMemberAvailability>[] = [
    { id: 'member', label: 'Team member', minWidth: 200, sortValue: (m) => m.employeeName, render: (m) => <EmployeeCell employee={m} /> },
    { id: 'status', label: 'Today', sortValue: (m) => m.status, render: (m) => <ToneChip tone={STATUS_TONE[m.status]} label={m.leave ? `${STATUS_LABEL[m.status]} · ${m.leave.leaveTypeName}` : STATUS_LABEL[m.status]} /> },
    { id: 'handovers', label: 'Covering', align: 'right', sortValue: (m) => m.openHandoversAsBackup, render: (m) => `${m.openHandoversAsBackup} handover(s)` },
    { id: 'tasks', label: 'Open tasks', align: 'right', sortValue: (m) => m.openTasks, render: (m) => m.openTasks },
    {
      id: 'load',
      label: 'Workload',
      sortValue: (m) => (m.isOverloaded ? 2 : m.openHandoversAsBackup > 0 ? 1 : 0),
      render: (m) =>
        m.isOverloaded ? <ToneChip tone="error" label="Overloaded" /> : m.openHandoversAsBackup > 0 ? <ToneChip tone="warning" label="Extra duties" /> : <ToneChip tone="success" label="Normal" />,
    },
  ];

  return (
    <Box>
      <WelcomeBanner subtitle="Here's how your team is doing today." />
      {isLoading || !data ? (
        <CardsSkeleton count={6} />
      ) : (
        <Grid container spacing={2}>
          {[
            { label: 'Team members', value: data.cards.teamMembers, icon: <Users size={20} />, color: palette.indigo, to: '/team' },
            { label: 'On leave today', value: data.cards.onLeaveToday, icon: <CalendarOff size={20} />, color: palette.rejected, to: '/team' },
            { label: 'Pending approvals', value: data.cards.pendingApprovals, icon: <ClipboardCheck size={20} />, color: palette.pending, to: '/approvals' },
            { label: 'Upcoming leaves', value: data.cards.upcomingLeaves, icon: <CalendarClock size={20} />, color: palette.teal, to: '/calendar' },
            { label: 'Awaiting handover acceptance', value: data.cards.pendingHandoverAcceptance, icon: <UserRoundCheck size={20} />, color: palette.inProgress, to: '/handovers' },
            { label: 'Active handovers', value: data.cards.activeHandovers, icon: <Repeat2 size={20} />, color: palette.approved, to: '/handovers' },
          ].map((c, i) => (
            <Grid key={c.label} size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
              <StatCard index={i} label={c.label} value={c.value} icon={c.icon} color={c.color} onClick={() => navigate(c.to)} />
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <DataTable
            title={<Typography variant="h6" sx={{ mr: 1 }}>Pending approvals</Typography>}
            rows={data?.pendingApprovals}
            columns={approvalColumns}
            rowKey={(r) => r.leaveId}
            loading={isLoading}
            searchable={false}
            pageSize={5}
            onRowClick={(r) => setLeaveId(r.leaveId)}
            actions={<Button size="small" onClick={() => navigate('/approvals')}>All approvals</Button>}
            emptyTitle="All caught up"
            emptyDescription="No leave requests are waiting for your decision."
            emptyIcon={<CheckCircle2 size={24} />}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Upcoming team leave" action={<Button size="small" onClick={() => navigate('/calendar')}>Calendar</Button>}>
            {data ? <UpcomingLeaveList leaves={data.upcomingLeaves.slice(0, 5)} onOpen={(l) => setLeaveId(l.leaveId)} showEmployee /> : <CardsSkeleton count={2} height={60} />}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <DataTable
            title={
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
                <Typography variant="h6">Team workload</Typography>
                {data && data.workload.some((m) => m.isOverloaded) && <Chip size="small" color="warning" icon={<AlertTriangle size={13} />} label="Overloaded backups" />}
              </Stack>
            }
            rows={data?.workload}
            columns={workloadColumns}
            rowKey={(m) => m.employeeId}
            loading={isLoading}
            pageSize={6}
            searchPlaceholder="Search team…"
            initialSort={{ id: 'load', direction: 'desc' }}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Team leave trend" subtitle="Approved days, last 6 months">
            <Box sx={{ height: 240 }}>
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.leaveTrend.map((t) => ({ ...t, label: fmtMonth(t.month) }))} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={palette.indigo} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={palette.indigo} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke={theme.palette.text.secondary} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke={theme.palette.text.secondary} />
                    <ChartTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }} formatter={(v: number) => [`${v} days`, 'Approved leave']} />
                    <Area type="monotone" dataKey="days" stroke={palette.indigo} strokeWidth={2.5} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </SectionCard>
        </Grid>
        {data && (
          <Grid size={12}>
            <TeamCalendarCard
              members={data.workload}
              canOpen={(id) => data.workload.some((m) => m.employeeId === id)}
              onOpenLeave={setLeaveId}
            />
          </Grid>
        )}
      </Grid>
      <LeaveDetailsDrawer leaveId={leaveId} onClose={() => setLeaveId(null)} />
    </Box>
  );
}
