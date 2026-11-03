import { Avatar, AvatarGroup, Box, Button, Card, Chip, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarPlus, PartyPopper } from 'lucide-react';
import type { Holiday, LeaveRequestView, TeamAvailability, TeamMemberAvailability } from '@leaveflow/shared';
import { EmployeeAvatar, EmptyState, LeaveStatusChip } from '@/components/common';
import { palette } from '@/theme/tokens';
import { colorFor, fmtDate, fmtDays, fmtRange, greeting, initials } from '@/utils/format';
import { useAuth, useToday } from '@/hooks';
import dayjs from 'dayjs';
import { useCalendarQuery } from '@/app/store/api';
import { TeamTimeline } from '@/components/calendar';
import { SectionCard } from '@/components/common';

/** Personalised welcome banner with the primary call to action. */
export function WelcomeBanner({ nextHoliday, subtitle }: { nextHoliday?: Holiday; subtitle?: string }) {
  const { user } = useAuth();
  const today = useToday();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <Card
      sx={{
        p: { xs: 2.5, md: 3.5 },
        mb: 3,
        border: 0,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(120deg, ${palette.navy} 0%, ${palette.indigo} 65%, ${palette.teal} 130%)`,
      }}
    >
      <Box sx={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', bgcolor: alpha('#fff', 0.06) }} />
      <Box sx={{ position: 'absolute', right: 80, bottom: -90, width: 200, height: 200, borderRadius: '50%', bgcolor: alpha('#fff', 0.05) }} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ position: 'relative' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <EmployeeAvatar name={user.employeeName} image={user.profileImage} size={60} sx={{ border: `3px solid ${alpha('#fff', 0.3)}` }} />
          <Box>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.75) }}>{fmtDate(today, 'dddd, DD MMMM YYYY')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{greeting()}, {user.employeeName.split(' ')[0]} 👋</Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.8), mt: 0.25 }}>
              {subtitle ?? `${user.designation} · ${user.department}${user.managerName ? ` · Reports to ${user.managerName}` : ''}`}
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ width: { xs: '100%', md: 'auto' } }}>
          {nextHoliday && (
            <Chip
              icon={<PartyPopper size={15} color="#fff" />}
              label={`Next holiday: ${nextHoliday.holidayName}, ${fmtDate(nextHoliday.holidayDate, 'DD MMM')}`}
              sx={{ bgcolor: alpha('#fff', 0.14), color: '#fff', border: `1px solid ${alpha('#fff', 0.2)}`, height: 34 }}
            />
          )}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button fullWidth variant="contained" startIcon={<CalendarPlus size={18} />} onClick={() => navigate('/apply-leave')} sx={{ bgcolor: '#fff', color: palette.navy, boxShadow: 'none', '&:hover': { bgcolor: alpha('#fff', 0.9), boxShadow: 'none' } }}>
              Apply leave
            </Button>
          </motion.div>
        </Stack>
      </Stack>
    </Card>
  );
}

/** Compact list of upcoming leave items. */
export function UpcomingLeaveList({ leaves, onOpen, showEmployee }: { leaves: LeaveRequestView[]; onOpen: (l: LeaveRequestView) => void; showEmployee?: boolean }) {
  if (!leaves.length) return <EmptyState compact title="No upcoming leave" description="Approved and pending leave will show up here." icon={<CalendarPlus size={22} />} />;
  return (
    <Stack spacing={1.25}>
      {leaves.map((l, i) => (
        <motion.div key={l.leaveId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
          <Box
            component="button"
            onClick={() => onOpen(l)}
            sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1, cursor: 'pointer', border: 1, borderColor: 'divider', transition: 'all 150ms', '&:hover': { borderColor: l.leaveTypeColor, bgcolor: alpha(l.leaveTypeColor, 0.04) }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}
          >
            <Stack alignItems="center" justifyContent="center" sx={{ width: 48, height: 52, borderRadius: 1, bgcolor: alpha(l.leaveTypeColor, 0.12), color: l.leaveTypeColor, flexShrink: 0 }}>
              <Typography variant="caption" fontWeight={700} lineHeight={1}>{fmtDate(l.startDate, 'MMM').toUpperCase()}</Typography>
              <Typography variant="h6" lineHeight={1.1}>{fmtDate(l.startDate, 'DD')}</Typography>
            </Stack>
            {showEmployee && <EmployeeAvatar name={l.employee?.employeeName} size={32} />}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{showEmployee ? l.employee?.employeeName : l.leaveTypeName}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {showEmployee ? `${l.leaveTypeName} · ` : ''}{fmtRange(l.startDate, l.endDate)} · {fmtDays(l.totalDays)}
              </Typography>
            </Box>
            <LeaveStatusChip status={l.status} />
          </Box>
        </motion.div>
      ))}
    </Stack>
  );
}

function AvatarStack({ members, max = 6 }: { members: TeamMemberAvailability[]; max?: number }) {
  if (!members.length) return <Typography variant="caption" color="text.secondary">Nobody</Typography>;
  return (
    <AvatarGroup max={max} sx={{ justifyContent: 'flex-end', '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 12, borderColor: 'background.paper' } }}>
      {members.map((m) => (
        <Tooltip key={m.employeeId} title={`${m.employeeName}${m.leave ? ` — ${m.leave.leaveTypeName} until ${fmtDate(m.leave.endDate, 'DD MMM')}` : ''}`}>
          <Avatar sx={{ bgcolor: colorFor(m.employeeName) }}>{initials(m.employeeName)}</Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

/** Today's availability summary for the employee's team. */
export function TeamAvailabilitySummary({ data, remoteEnabled }: { data: TeamAvailability; remoteEnabled: boolean }) {
  const rows = [
    { label: 'Available today', color: palette.approved, members: data.available },
    { label: 'On leave today', color: palette.rejected, members: data.onLeave },
    ...(remoteEnabled ? [{ label: 'Working remotely', color: palette.inProgress, members: data.remote }] : []),
  ];
  return (
    <Stack spacing={1.5}>
      {rows.map((r) => (
        <Stack key={r.label} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.color }} />
            <Typography variant="body2">{r.label}</Typography>
            <Typography variant="body2" fontWeight={700}>{r.members.length}</Typography>
          </Stack>
          <AvatarStack members={r.members} />
        </Stack>
      ))}
      {data.upcoming.length > 0 && (
        <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">Upcoming leave</Typography>
          <Stack spacing={0.75} sx={{ mt: 0.75 }}>
            {data.upcoming.slice(0, 4).map((u) => (
              <Stack key={u.leaveId} direction="row" spacing={1} alignItems="center">
                <EmployeeAvatar name={u.employeeName} size={24} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{u.employeeName}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{fmtRange(u.startDate, u.endDate)}</Typography>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: u.status === 'APPROVED' ? u.color : palette.pending, flexShrink: 0 }} />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

/** Two-week "planned absences" timeline for a set of colleagues. */
export function TeamCalendarCard({ members, onOpenLeave, canOpen, title = 'Team calendar', department }: {
  members: TeamMemberAvailability[];
  onOpenLeave: (leaveId: string) => void;
  canOpen: (employeeId: string) => boolean;
  title?: string;
  department?: string;
}) {
  const today = useToday();
  const navigate = useNavigate();
  const { settings } = useAuth();
  const start = dayjs(today).startOf('week').add(1, 'day').format('YYYY-MM-DD');
  const end = dayjs(start).add(13, 'day').format('YYYY-MM-DD');
  const ids = new Set(members.map((m) => m.employeeId));
  const { data } = useCalendarQuery({ from: start, to: end, department });
  return (
    <SectionCard title={title} subtitle={`${fmtDate(start, 'DD MMM')} – ${fmtDate(end, 'DD MMM YYYY')}`} action={<Button size="small" onClick={() => navigate('/calendar')}>Full calendar</Button>} noPadding>
      <Box sx={{ px: 1, pb: 1 }}>
        <TeamTimeline
          members={members}
          events={(data?.events ?? []).filter((e) => ids.has(e.employeeId))}
          holidays={data?.holidays}
          start={start}
          days={14}
          today={today}
          workingDays={settings?.workingDays}
          onEventClick={(e) => canOpen(e.employeeId) && onOpenLeave(e.leaveId)}
          maxHeight={360}
        />
      </Box>
    </SectionCard>
  );
}
