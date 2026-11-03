import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import { Box, Button, Card, FormControlLabel, Grid, IconButton, Stack, Switch, ToggleButton, ToggleButtonGroup, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { CalendarDays, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { addDays, dayjs, type CalendarLeaveEvent } from '@leaveflow/shared';
import { useCalendarQuery, useDepartmentsQuery, useEmployeesQuery, useLeaveTypesQuery, useTeamAvailabilityQuery } from '@/app/store/api';
import { ChartLegend } from '@/components/charts';
import { DetailPanel, EmployeeCell, EmptyState, ErrorState, FilterSelect, LeaveStatusChip, LeaveTypeChip, PageHeader, SectionCard } from '@/components/common';
import { useAuth, useResponsive, useToday } from '@/hooks';
import { palette } from '@/theme/tokens';
import { fmtDays, fmtRange, fmtShort } from '@/utils/format';
import { LeaveDetailsDrawer } from '../leaves/LeaveDetailsDrawer';

type ViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';
const VIEWS: { value: ViewType; label: string }[] = [
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'timeGridWeek', label: 'Week' },
  { value: 'timeGridDay', label: 'Day' },
  { value: 'listMonth', label: 'List' },
];

/** Full-page leave calendar (month / week / day / list) with filters and holiday indicators. */
export default function CalendarPage() {
  const theme = useTheme();
  const today = useToday();
  const { user, isManager, isAdmin } = useAuth();
  const { isMobile } = useResponsive();
  const calRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<ViewType>(isMobile ? 'listMonth' : 'dayGridMonth');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState(() => ({ from: dayjs(today).startOf('month').subtract(7, 'day').format('YYYY-MM-DD'), to: dayjs(today).endOf('month').add(7, 'day').format('YYYY-MM-DD') }));
  const [department, setDepartment] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [includePending, setIncludePending] = useState(true);
  const [openLeave, setOpenLeave] = useState<string | null>(null);
  const [preview, setPreview] = useState<CalendarLeaveEvent | null>(null);

  const { data, isFetching, error, refetch } = useCalendarQuery({ ...range, department: department || undefined, leaveType: leaveType || undefined, employeeId: employeeId || undefined, includePending });
  const { data: departments } = useDepartmentsQuery();
  const { data: leaveTypes } = useLeaveTypesQuery();
  const { data: employees } = useEmployeesQuery(undefined, { skip: !isManager });
  const { data: availability } = useTeamAvailabilityQuery();

  const reports = useMemo(() => new Set((employees ?? []).filter((e) => e.managerId === user?.employeeId).map((e) => e.employeeId)), [employees, user]);
  const isList = view === 'listMonth';

  const events = useMemo<EventInput[]>(() => {
    const leaves: EventInput[] = (data?.events ?? []).map((e) => {
      const pending = e.status !== 'APPROVED';
      return {
        id: e.leaveId,
        title: `${e.employeeName} · ${e.leaveTypeName}${e.halfDay !== 'NONE' ? ' (½)' : ''}`,
        start: e.startDate,
        end: addDays(e.endDate, 1), // FullCalendar end dates are exclusive
        allDay: true,
        backgroundColor: pending ? alpha(e.color, 0.14) : e.color,
        borderColor: e.color,
        textColor: pending ? e.color : '#fff',
        classNames: pending ? ['lf-pending'] : [],
        extendedProps: { kind: 'leave', leave: e },
      };
    });
    const holidays: EventInput[] = (data?.holidays ?? []).map((h) => ({
      id: h.holidayId,
      title: `Holiday · ${h.holidayName}`,
      start: h.holidayDate,
      allDay: true,
      display: isList ? 'auto' : 'background',
      backgroundColor: isList ? palette.rejected : alpha(palette.rejected, h.holidayType === 'OPTIONAL' ? 0.05 : 0.1),
      borderColor: palette.rejected,
      classNames: ['lf-holiday'],
      extendedProps: { kind: 'holiday', holidayType: h.holidayType },
    }));
    return [...holidays, ...leaves];
  }, [data, isList]);

  const api = () => calRef.current?.getApi();
  const onDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type as ViewType);
    const from = dayjs(arg.start).format('YYYY-MM-DD');
    const to = dayjs(arg.end).subtract(1, 'day').format('YYYY-MM-DD');
    setRange((r) => (r.from === from && r.to === to ? r : { from, to }));
  };

  const onEventClick = (arg: EventClickArg) => {
    if (arg.event.extendedProps.kind !== 'leave') return;
    const leave = arg.event.extendedProps.leave as CalendarLeaveEvent;
    const allowed = leave.employeeId === user?.employeeId || isAdmin || reports.has(leave.employeeId);
    if (allowed) setOpenLeave(leave.leaveId);
    else setPreview(leave);
  };

  const renderEvent = (arg: EventContentArg) => {
    if (arg.event.extendedProps.kind === 'holiday' && arg.event.display === 'background') {
      return (
        <Typography variant="caption" sx={{ position: 'absolute', bottom: 2, left: 4, right: 4, fontSize: 10, fontWeight: 600, color: 'error.main', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {arg.event.title.replace('Holiday · ', '')}
        </Typography>
      );
    }
    return undefined;
  };

  const legend = [
    ...(leaveTypes ?? []).filter((t) => t.isActive && (data?.events ?? []).some((e) => e.leaveType === t.code)).map((t) => ({ label: t.name, color: t.color })),
    ...(includePending ? [{ label: 'Pending', color: palette.neutral, hatched: true }] : []),
    { label: 'Holiday', color: alpha(palette.rejected, 0.35) },
  ];

  const fc = {
    '--fc-border-color': theme.palette.divider,
    '--fc-page-bg-color': theme.palette.background.paper,
    '--fc-neutral-bg-color': theme.palette.background.default,
    '--fc-today-bg-color': alpha(theme.palette.primary.main, 0.06),
    '--fc-list-event-hover-bg-color': theme.palette.action.hover,
    '--fc-event-border-color': 'transparent',
    '& .fc': { fontFamily: theme.typography.fontFamily, fontSize: 13 },
    '& .fc .fc-col-header-cell-cushion': { color: theme.palette.text.secondary, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', py: 1, textDecoration: 'none' },
    '& .fc .fc-daygrid-day-number': { color: theme.palette.text.primary, fontWeight: 600, textDecoration: 'none', p: 0.75 },
    '& .fc .fc-day-today .fc-daygrid-day-number': { bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'grid', placeItems: 'center', m: 0.5, p: 0 },
    '& .fc .fc-day-sat, & .fc .fc-day-sun': { bgcolor: alpha(theme.palette.text.secondary, 0.03) },
    '& .fc .fc-daygrid-event, & .fc .fc-timegrid-event': { borderRadius: '6px', px: 0.5, py: 0.1, fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'transform 120ms ease', '&:hover': { transform: 'translateY(-1px)' } },
    '& .fc .lf-pending': { borderStyle: 'dashed !important', borderWidth: '1.5px !important', backgroundImage: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.18) 0 4px, transparent 4px 8px)' },
    '& .fc .fc-bg-event.lf-holiday': { opacity: 1 },
    '& .fc .fc-list-event': { cursor: 'pointer' },
    '& .fc .fc-list-day-cushion': { bgcolor: theme.palette.background.default },
    '& .fc .fc-scrollgrid': { borderRadius: 1, overflow: 'hidden' },
    '& .fc a': { color: 'inherit' },
    '& .fc .fc-daygrid-more-link': { color: theme.palette.primary.main, fontWeight: 600 },
    '& .fc .fc-list-empty': { bgcolor: 'transparent' },
  } as const;

  return (
    <Box>
      <PageHeader
        title={isManager ? 'Team Calendar' : 'Leave Calendar'}
        subtitle="Approved and pending leave across your team, with public holidays"
        icon={<CalendarDays size={22} />}
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Card sx={{ p: { xs: 1.5, sm: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton onClick={() => api()?.prev()} aria-label="Previous"><ChevronLeft size={18} /></IconButton>
                <Button variant="outlined" size="small" onClick={() => api()?.today()}>Today</Button>
                <IconButton onClick={() => api()?.next()} aria-label="Next"><ChevronRight size={18} /></IconButton>
                <Typography variant="h6" sx={{ ml: 1 }} noWrap>{title}</Typography>
              </Stack>
              <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: ViewType | null) => v && api()?.changeView(v)} aria-label="Calendar view">
                {VIEWS.map((v) => <ToggleButton key={v.value} value={v.value} sx={{ px: 1.75, textTransform: 'none', fontWeight: 600 }}>{v.label}</ToggleButton>)}
              </ToggleButtonGroup>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
              {(isManager || isAdmin) && (
                <FilterSelect label="Department" value={department} onChange={setDepartment} allLabel="All departments" options={(departments ?? []).map((d) => ({ value: d.departmentName, label: d.departmentName }))} />
              )}
              <FilterSelect label="Leave type" value={leaveType} onChange={setLeaveType} allLabel="All types" options={(leaveTypes ?? []).filter((t) => t.isActive).map((t) => ({ value: t.code, label: t.name }))} />
              {isManager && (
                <FilterSelect label="Employee" value={employeeId} onChange={setEmployeeId} allLabel="Everyone" minWidth={180} options={(employees ?? []).map((e) => ({ value: e.employeeId, label: e.employeeName }))} />
              )}
              <FormControlLabel control={<Switch checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} />} label="Show pending" />
              {isFetching && <Typography variant="caption" color="text.secondary">Updating…</Typography>}
            </Stack>
            {error && <ErrorState error={error} onRetry={refetch} />}
            <Box sx={{ mb: 2 }}>
              <ChartLegend items={legend} />
            </Box>
            <Box sx={fc}>
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView={view}
                initialDate={today}
                headerToolbar={false}
                firstDay={1}
                height={view.startsWith('timeGrid') ? 680 : 'auto'}
                dayMaxEvents={3}
                allDaySlot
                slotMinTime="08:00:00"
                slotMaxTime="20:00:00"
                nowIndicator
                events={events}
                eventClick={onEventClick}
                eventContent={renderEvent}
                datesSet={onDatesSet}
                noEventsContent="No leave in this period"
                eventDisplay="block"
              />
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={2.5}>
            <SectionCard title="Away today" subtitle={dayjs(today).format('dddd, DD MMM')}>
              {!availability ? (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              ) : availability.onLeave.length === 0 ? (
                <EmptyState compact title="Everyone is in" icon={<Users size={22} />} />
              ) : (
                <Stack spacing={1.5}>
                  {availability.onLeave.map((m) => (
                    <Stack key={m.employeeId} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <EmployeeCell employee={m} secondary={m.leave ? `Back after ${fmtShort(m.leave.endDate)}` : m.designation} size={30} />
                      {m.leave && <LeaveTypeChip name={m.leave.leaveTypeName} color={m.leave.color} />}
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>
            <SectionCard title="Team at a glance">
              {availability ? (
                <Stack spacing={1}>
                  {[
                    { label: 'Available', value: availability.available.length, color: palette.approved },
                    { label: 'On leave', value: availability.onLeave.length, color: palette.rejected },
                    { label: 'Working remotely', value: availability.remote.length, color: palette.inProgress },
                    { label: 'Upcoming (30 days)', value: availability.upcoming.length, color: palette.pending },
                  ].map((s) => (
                    <Stack key={s.label} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                      </Stack>
                      <Typography variant="subtitle2">{s.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <LeaveDetailsDrawer leaveId={openLeave} onClose={() => setOpenLeave(null)} />
      <DetailPanel open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? `${preview.employeeName} is away` : ''} subtitle={preview?.department} width={420}>
        {preview && (
          <Stack spacing={2}>
            <EmployeeCell employee={{ employeeName: preview.employeeName }} secondary={preview.department} size={42} />
            <Stack direction="row" spacing={1}>
              <LeaveTypeChip name={preview.leaveTypeName} color={preview.color} />
              <LeaveStatusChip status={preview.status} />
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">Dates</Typography>
              <Typography variant="body2">{fmtRange(preview.startDate, preview.endDate)} · {fmtDays(preview.totalDays, preview.halfDay)}</Typography>
            </Box>
            <Tooltip title="Leave reasons are only visible to the employee, their manager and HR">
              <Typography variant="caption" color="text.secondary">Details are private to the employee and their approver.</Typography>
            </Tooltip>
          </Stack>
        )}
      </DetailPanel>
    </Box>
  );
}
