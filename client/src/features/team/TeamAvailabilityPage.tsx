import { useMemo, useState, type ReactNode } from 'react';
import { Box, Chip, Grid, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Home, Plane, UserCheck, UsersRound } from 'lucide-react';
import { addDays, dayjs, type TeamMemberAvailability } from '@leaveflow/shared';
import { useCalendarQuery, useDepartmentsQuery, useTeamAvailabilityQuery, useEmployeesQuery } from '@/app/store/api';
import { TeamTimeline } from '@/components/calendar';
import { CardsSkeleton, EmployeeCell, EmptyState, ErrorState, FilterSelect, LeaveStatusChip, LeaveTypeChip, PageHeader, SectionCard, StatCard, TableSkeleton } from '@/components/common';
import { useAuth, useToday } from '@/hooks';
import { palette } from '@/theme/tokens';
import { fmtRange, fmtShort } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';

function Workload({ m }: { m: TeamMemberAvailability }) {
  if (!m.openHandoversAsBackup && !m.openTasks) return null;
  return (
    <Tooltip title={`Covering ${m.openHandoversAsBackup} handover(s) with ${m.openTasks} open task(s)${m.isOverloaded ? ' — overloaded' : ''}`}>
      <Chip
        size="small"
        icon={m.isOverloaded ? <AlertTriangle size={13} /> : undefined}
        label={`${m.openHandoversAsBackup} HO · ${m.openTasks} tasks`}
        color={m.isOverloaded ? 'warning' : 'default'}
        variant="outlined"
        sx={{ height: 22, fontSize: 11 }}
      />
    </Tooltip>
  );
}

function MemberList({ title, icon, color, members, empty, render }: { title: string; icon: ReactNode; color: string; members: TeamMemberAvailability[]; empty: string; render?: (m: TeamMemberAvailability) => ReactNode }) {
  return (
    <SectionCard
      title={
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
          <Typography variant="h6">{title}</Typography>
          <Chip size="small" label={members.length} sx={{ height: 22 }} />
        </Stack>
      }
    >
      {members.length === 0 ? (
        <EmptyState compact title={empty} icon={icon} />
      ) : (
        <Stack spacing={1.5} sx={{ maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
          {members.map((m, i) => (
            <motion.div key={m.employeeId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <EmployeeCell employee={m} secondary={`${m.designation} · ${m.department}`} size={32} />
                <Stack alignItems="flex-end" spacing={0.5} flexShrink={0}>
                  {render?.(m)}
                  <Workload m={m} />
                </Stack>
              </Stack>
            </motion.div>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

/** Who is available, on leave or remote on a given day, plus a 14-day planned-absence grid. */
export default function TeamAvailabilityPage() {
  const today = useToday();
  const { user, isManager, settings } = useAuth();
  const [date, setDate] = useState(today);
  const [department, setDepartment] = useState('');
  const [timelineStart, setTimelineStart] = useState(() => dayjs(today).startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const DAYS = 14;

  const { data, isLoading, isFetching, error, refetch } = useTeamAvailabilityQuery({ date, department: department || undefined });
  const { data: departments } = useDepartmentsQuery();
  const { data: calendar, isLoading: calLoading } = useCalendarQuery({ from: timelineStart, to: addDays(timelineStart, DAYS - 1), department: department || undefined });

  const members = useMemo(
    () => [...(data?.members ?? [])].sort((a, b) => a.department.localeCompare(b.department) || a.employeeName.localeCompare(b.employeeName)),
    [data],
  );
  const overloaded = members.filter((m) => m.isOverloaded);
  // Colleagues only see dates; details open for own leave or for managers/HR.
  // Only open full details where the API allows it: own leave, direct reports, or HR.
  const { data: directory } = useEmployeesQuery(undefined, { skip: !isManager });
  const canOpen = (employeeId: string) =>
    employeeId === user?.employeeId || user?.role === 'ADMIN' || Boolean(directory?.some((d) => d.employeeId === employeeId && d.managerId === user?.employeeId));
  const openLeave = (e: { leaveId: string; employeeId: string }) => {
    if (canOpen(e.employeeId)) setLeaveId(e.leaveId);
  };

  return (
    <Box>
      <PageHeader
        title="Team Availability"
        subtitle={isManager ? 'Coverage, absences and backup workload across your team' : 'See who is in, away or working remotely'}
        icon={<UsersRound size={22} />}
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <DatePicker
              label="Date"
              value={dayjs(date)}
              onChange={(v) => v && v.isValid() && setDate(v.format('YYYY-MM-DD'))}
              slotProps={{ textField: { size: 'small', sx: { minWidth: 170 } } }}
            />
            {(isManager || (departments?.length ?? 0) > 1) && (
              <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="All departments" minWidth={190} options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
            )}
          </Stack>
        }
      />

      {error && <ErrorState error={error} onRetry={refetch} />}
      {isLoading || !data ? (
        <CardsSkeleton count={4} height={110} />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, opacity: isFetching ? 0.7 : 1, transition: 'opacity 150ms' }}>
          <StatCard index={0} label="Available" value={data.available.length} icon={<UserCheck size={20} />} color={palette.approved} caption={`of ${data.members.length} people`} progress={data.members.length ? (data.available.length / data.members.length) * 100 : 0} />
          <StatCard index={1} label="On leave" value={data.onLeave.length} icon={<Plane size={20} />} color={palette.rejected} caption={date === today ? 'Today' : dayjs(date).format('DD MMM')} />
          <StatCard index={2} label="Working remotely" value={data.remote.length} icon={<Home size={20} />} color={palette.inProgress} caption={settings?.remoteWorkEnabled ? 'Remote / hybrid schedule' : 'Remote tracking disabled'} />
          <StatCard index={3} label="Upcoming leave" value={data.upcoming.length} icon={<CalendarClock size={20} />} color={palette.pending} caption="Next 30 days" />
        </Box>
      )}

      {overloaded.length > 0 && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, border: 1, borderColor: 'warning.light', bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(217,119,6,0.08)' : '#FFFBEB'), display: 'flex', gap: 1, alignItems: 'center' }}>
          <AlertTriangle size={18} color={palette.pending} />
          <Typography variant="body2">
            <b>{overloaded.map((m) => m.employeeName).join(', ')}</b> {overloaded.length === 1 ? 'is' : 'are'} covering {settings?.backupOverloadThreshold ?? 2}+ handovers and may be overloaded.
          </Typography>
        </Box>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          {data ? (
            <MemberList title="Available" icon={<UserCheck size={18} />} color={palette.approved} members={data.available} empty="Nobody is available" />
          ) : (
            <TableSkeleton rows={4} />
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          {data && (
            <MemberList
              title="On leave"
              icon={<Plane size={18} />}
              color={palette.rejected}
              members={data.onLeave}
              empty="Everyone is in"
              render={(m) =>
                m.leave && (
                  <Stack alignItems="flex-end" spacing={0.25}>
                    <LeaveTypeChip name={m.leave.leaveTypeName} color={m.leave.color} />
                    <Typography variant="caption" color="text.secondary">Back {fmtShort(addDays(m.leave.endDate, 1))}</Typography>
                  </Stack>
                )
              }
            />
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          {data && <MemberList title="Working remotely" icon={<Home size={18} />} color={palette.inProgress} members={data.remote} empty={settings?.remoteWorkEnabled ? 'No one is remote' : 'Remote tracking is disabled'} />}
        </Grid>
        <Grid size={12}>
          <SectionCard
            title="Planned absences"
            subtitle={fmtRange(timelineStart, addDays(timelineStart, DAYS - 1))}
            action={
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={() => setTimelineStart((s) => addDays(s, -7))} aria-label="Previous week"><ChevronLeft size={18} /></IconButton>
                <IconButton size="small" onClick={() => setTimelineStart(dayjs(today).startOf('week').add(1, 'day').format('YYYY-MM-DD'))} aria-label="This week"><CalendarClock size={16} /></IconButton>
                <IconButton size="small" onClick={() => setTimelineStart((s) => addDays(s, 7))} aria-label="Next week"><ChevronRight size={18} /></IconButton>
              </Stack>
            }
          >
            {calLoading || !data ? (
              <TableSkeleton rows={5} />
            ) : (
              <TeamTimeline
                members={members}
                events={calendar?.events ?? []}
                holidays={calendar?.holidays ?? []}
                start={timelineStart}
                days={DAYS}
                today={today}
                workingDays={settings?.workingDays}
                maxHeight={520}
                onEventClick={openLeave}
              />
            )}
          </SectionCard>
        </Grid>

        <Grid size={12}>
          <SectionCard title="Upcoming leave" subtitle="Next 30 days">
            {!data ? (
              <TableSkeleton rows={3} />
            ) : data.upcoming.length === 0 ? (
              <EmptyState compact title="No upcoming leave" icon={<CalendarClock size={22} />} />
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
                {data.upcoming.map((e) => (
                  <Box
                    key={e.leaveId}
                    onClick={() => openLeave(e)}
                    sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, borderLeft: `4px solid ${e.color}`, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <EmployeeCell employee={{ employeeName: e.employeeName }} secondary={e.department} size={30} />
                      <LeaveStatusChip status={e.status} />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {e.leaveTypeName} · {fmtRange(e.startDate, e.endDate)} · {e.totalDays}d
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>
        </Grid>
      </Grid>
      <LeaveDetailsDrawer leaveId={leaveId} onClose={() => setLeaveId(null)} />
    </Box>
  );
}
