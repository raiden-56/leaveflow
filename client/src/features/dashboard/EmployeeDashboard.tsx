import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion } from 'framer-motion';
import { CalendarCheck, CalendarClock, CheckCircle2, Clock3, HeartPulse, Hourglass, Palmtree, Repeat2, Sun, UserCheck, Wallet } from 'lucide-react';
import type { LeaveBalanceView } from '@leaveflow/shared';
import { useEmployeeDashboardQuery, useTeamAvailabilityQuery } from '@/app/store/api';
import { CardsSkeleton, EmptyState, ErrorState, HandoverStatusChip, SectionCard, StatCard, EmployeeCell } from '@/components/common';
import { useAuth } from '@/hooks';
import { palette } from '@/theme/tokens';
import { fmtRange } from '@/utils/format';
import { HandoverDetailsDrawer } from '../handovers/HandoverDetailsDrawer';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';
import { LeaveTable } from '../leaves/LeaveTable';
import { TeamAvailabilitySummary, TeamCalendarCard, UpcomingLeaveList, WelcomeBanner } from './widgets';

function balanceCard(b: LeaveBalanceView | undefined, label: string, icon: React.ReactNode, color: string, index: number) {
  return (
    <StatCard
      index={index}
      label={label}
      value={b ? b.available : '–'}
      icon={icon}
      color={color}
      caption={b ? `${b.used} used · ${b.pending} pending of ${b.total}` : 'Not allocated'}
      progress={b && b.total ? ((b.used + b.pending) / b.total) * 100 : 0}
    />
  );
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { settings, user } = useAuth();
  const { data, isLoading, error, refetch } = useEmployeeDashboardQuery();
  const { data: team } = useTeamAvailabilityQuery();
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const [handoverId, setHandoverId] = useState<string | null>(null);

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const find = (code: string) => data?.balances.find((b) => b.leaveType === code);
  const hs = data?.handoverStats;

  return (
    <Box>
      <WelcomeBanner nextHoliday={data?.nextHoliday} />

      {isLoading || !data ? (
        <CardsSkeleton count={6} />
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <StatCard index={0} label="Total leave balance" value={data.totals.available} icon={<Wallet size={20} />} color={palette.indigo} caption={`of ${data.totals.allocated} days this year`} progress={data.totals.allocated ? ((data.totals.used + data.totals.pending) / data.totals.allocated) * 100 : 0} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>{balanceCard(find('AL'), 'Annual leave', <Palmtree size={20} />, palette.teal, 1)}</Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>{balanceCard(find('SL'), 'Sick leave', <HeartPulse size={20} />, palette.rejected, 2)}</Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>{balanceCard(find('CL'), 'Casual leave', <Sun size={20} />, palette.inProgress, 3)}</Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <StatCard index={4} label="Leaves taken" value={data.totals.used} icon={<CalendarCheck size={20} />} color={palette.approved} caption="Approved days this year" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 2 }}>
            <StatCard index={5} label="Pending requests" value={data.totals.pendingRequests} icon={<Hourglass size={20} />} color={palette.pending} caption={`${data.totals.pending} day(s) awaiting approval`} onClick={() => navigate('/my-leaves')} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title="Upcoming leaves" action={<Button size="small" onClick={() => navigate('/calendar')}>Calendar</Button>}>
            {data ? <UpcomingLeaveList leaves={data.upcomingLeaves} onOpen={(l) => setLeaveId(l.leaveId)} /> : <CardsSkeleton count={2} height={60} />}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <SectionCard title="Work handover overview" action={<Button size="small" onClick={() => navigate('/handovers')}>Open</Button>}>
            {hs ? (
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                  {[
                    { label: 'Active handovers', value: hs.createdActive + hs.assignedActive, icon: Repeat2, color: palette.inProgress },
                    { label: 'Tasks with backups', value: hs.tasksAssignedToBackups, icon: CalendarClock, color: palette.indigo },
                    { label: 'Accepted', value: hs.accepted, icon: UserCheck, color: palette.teal },
                    { label: 'Pending acceptance', value: hs.pendingAcceptance, icon: Clock3, color: palette.pending },
                    { label: 'Completed', value: hs.completed, icon: CheckCircle2, color: palette.approved },
                    { label: 'Overdue tasks', value: hs.overdueTasks, icon: Hourglass, color: palette.rejected },
                  ].map((s) => (
                    <motion.div key={s.label} whileHover={{ y: -2 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, borderRadius: 1, bgcolor: alpha(s.color, 0.06), border: `1px solid ${alpha(s.color, 0.15)}` }}>
                        <s.icon size={18} color={s.color} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" lineHeight={1}>{s.value}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">{s.label}</Typography>
                        </Box>
                      </Stack>
                    </motion.div>
                  ))}
                </Box>
                {data!.assignedHandovers.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">You are covering</Typography>
                    <Stack spacing={1} sx={{ mt: 0.75 }}>
                      {data!.assignedHandovers.map((h) => (
                        <Stack key={h.handoverId} direction="row" alignItems="center" spacing={1} onClick={() => setHandoverId(h.handoverId)} sx={{ cursor: 'pointer', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <EmployeeCell employee={h.employee} secondary={`${h.handoverTitle} · ${fmtRange(h.startDate, h.endDate)}`} size={30} />
                          </Box>
                          <HandoverStatusChip status={h.handoverStatus} />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            ) : (
              <CardsSkeleton count={2} height={60} />
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <SectionCard title="Team availability" subtitle="Your department today" action={<Button size="small" onClick={() => navigate('/team')}>Details</Button>}>
            {team ? <TeamAvailabilitySummary data={team} remoteEnabled={settings?.remoteWorkEnabled ?? true} /> : <CardsSkeleton count={2} height={50} />}
          </SectionCard>
        </Grid>
        {team && (
          <Grid size={12}>
            <TeamCalendarCard
              title="Team availability calendar"
              members={team.members}
              department={user?.department}
              canOpen={(id) => id === user?.employeeId}
              onOpenLeave={setLeaveId}
            />
          </Grid>
        )}
        <Grid size={12}>
          <LeaveTable
            title={<Typography variant="h6" sx={{ mr: 1 }}>Recent leave requests</Typography>}
            rows={data?.recentLeaves}
            loading={isLoading}
            onOpen={(l) => setLeaveId(l.leaveId)}
            pageSize={5}
            searchable={false}
            actions={<Button size="small" onClick={() => navigate('/my-leaves')}>View all</Button>}
            emptyDescription={<EmptyState compact title="" description="You haven't applied for leave yet." />}
          />
        </Grid>
      </Grid>

      <LeaveDetailsDrawer leaveId={leaveId} onClose={() => setLeaveId(null)} />
      <HandoverDetailsDrawer handoverId={handoverId} onClose={() => setHandoverId(null)} />
    </Box>
  );
}
