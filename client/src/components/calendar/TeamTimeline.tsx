import { Fragment, useMemo } from 'react';
import { Box, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { addDays, dayjs, eachDay, type CalendarLeaveEvent, type Holiday } from '@leaveflow/shared';
import { EmployeeAvatar } from '../common/EmployeeAvatar';
import { fmtRange } from '@/utils/format';

export interface TimelineMember {
  employeeId: string;
  employeeName: string;
  designation?: string;
  profileImage?: string;
}

export interface TeamTimelineProps {
  /** Rows, in display order. */
  members: TimelineMember[];
  /** Leave events (approved + pending). Events outside the window are clipped. */
  events: CalendarLeaveEvent[];
  /** Holidays; non-optional ones are shaded as non-working days. */
  holidays?: Pick<Holiday, 'holidayDate' | 'holidayName' | 'holidayType'>[];
  /** First visible day (YYYY-MM-DD). */
  start: string;
  /** Number of visible days (default 14). */
  days?: number;
  /** Highlighted "today" (YYYY-MM-DD). */
  today?: string;
  /** Working weekdays 0=Sun..6=Sat (default Mon–Fri). */
  workingDays?: number[];
  onEventClick?: (event: CalendarLeaveEvent) => void;
  /** Scroll vertically beyond this height. */
  maxHeight?: number;
  emptyText?: string;
}

const NAME_COL = { xs: 132, sm: 200 };
const DAY_MIN = 38;
const ROW_H = 48;

/**
 * "Planned absences" grid: one row per employee, one column per day.
 * Weekends/holidays are shaded, today is highlighted, approved leave is a solid
 * bar and pending leave a hatched, dashed bar. Scrolls horizontally on small screens.
 */
export function TeamTimeline({ members, events, holidays = [], start, days = 14, today, workingDays = [1, 2, 3, 4, 5], onEventClick, maxHeight, emptyText = 'No team members to show' }: TeamTimelineProps) {
  const theme = useTheme();
  const end = addDays(start, days - 1);
  const dates = useMemo(() => eachDay(start, end), [start, end]);
  const holidayMap = useMemo(() => new Map(holidays.filter((h) => h.holidayType !== 'OPTIONAL').map((h) => [h.holidayDate, h.holidayName])), [holidays]);
  const byMember = useMemo(() => {
    const map = new Map<string, CalendarLeaveEvent[]>();
    for (const e of events) {
      if (e.endDate < start || e.startDate > end) continue;
      map.set(e.employeeId, [...(map.get(e.employeeId) ?? []), e]);
    }
    return map;
  }, [events, start, end]);

  const shade = alpha(theme.palette.text.secondary, theme.palette.mode === 'dark' ? 0.1 : 0.06);
  const todayBg = alpha(theme.palette.primary.main, 0.08);
  const gridCols = `repeat(${days}, minmax(${DAY_MIN}px, 1fr))`;
  const isOff = (d: string) => !workingDays.includes(dayjs(d).day()) || holidayMap.has(d);

  if (members.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{emptyText}</Typography>;
  }

  return (
    <Box sx={{ overflow: 'auto', maxHeight, border: 1, borderColor: 'divider', borderRadius: 1 }} role="region" aria-label="Team leave timeline">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: `${NAME_COL.xs}px 1fr`, sm: `${NAME_COL.sm}px 1fr` }, minWidth: { xs: NAME_COL.xs + days * DAY_MIN, sm: NAME_COL.sm + days * DAY_MIN } }}>
        {/* header */}
        <Box sx={{ position: 'sticky', top: 0, left: 0, zIndex: 3, bgcolor: 'background.paper', borderBottom: 1, borderRight: 1, borderColor: 'divider', px: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            {dayjs(start).format('MMM YYYY')}
          </Typography>
        </Box>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 2, display: 'grid', gridTemplateColumns: gridCols, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          {dates.map((d) => {
            const isToday = d === today;
            const holiday = holidayMap.get(d);
            const cell = (
              <Box key={d} sx={{ textAlign: 'center', py: 0.75, bgcolor: isToday ? todayBg : isOff(d) ? shade : 'transparent' }}>
                <Typography variant="caption" component="div" color={isToday ? 'primary.main' : 'text.secondary'} sx={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>
                  {dayjs(d).format('dd')}
                </Typography>
                <Box sx={{ mx: 'auto', width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: isToday ? 'primary.main' : 'transparent', color: isToday ? '#fff' : holiday ? 'error.main' : 'text.primary' }}>
                  <Typography variant="caption" fontWeight={700}>{dayjs(d).date()}</Typography>
                </Box>
              </Box>
            );
            return holiday ? <Tooltip key={d} title={holiday}>{cell}</Tooltip> : cell;
          })}
        </Box>

        {/* rows */}
        {members.map((m, rowIdx) => {
          const memberEvents = byMember.get(m.employeeId) ?? [];
          return (
            <Fragment key={m.employeeId}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper', px: 1.5, height: ROW_H, borderRight: 1, borderBottom: rowIdx < members.length - 1 ? 1 : 0, borderColor: 'divider', minWidth: 0 }}
              >
                <EmployeeAvatar name={m.employeeName} image={m.profileImage} size={28} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 13 }}>{m.employeeName}</Typography>
                  {m.designation && <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ display: { xs: 'none', sm: 'block' } }}>{m.designation}</Typography>}
                </Box>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: gridCols, height: ROW_H, borderBottom: rowIdx < members.length - 1 ? 1 : 0, borderColor: 'divider', position: 'relative' }}>
                {dates.map((d, i) => (
                  <Box key={d} sx={{ gridRow: 1, gridColumn: i + 1, bgcolor: d === today ? todayBg : isOff(d) ? shade : 'transparent', borderLeft: i ? `1px dashed ${alpha(theme.palette.divider, 0.6)}` : 0 }} />
                ))}
                {memberEvents.map((e) => {
                  const s = Math.max(0, dayjs(e.startDate).diff(dayjs(start), 'day'));
                  const last = Math.min(days - 1, dayjs(e.endDate).diff(dayjs(start), 'day'));
                  const pending = e.status !== 'APPROVED';
                  const label = `${e.leaveTypeName}${pending ? ' (pending)' : ''}`;
                  return (
                    <Tooltip key={e.leaveId} title={`${e.employeeName} · ${label} · ${fmtRange(e.startDate, e.endDate)} · ${e.totalDays} day(s)`}>
                      <Box
                        component={onEventClick ? 'button' : 'div'}
                        onClick={onEventClick ? () => onEventClick(e) : undefined}
                        aria-label={`${e.employeeName} ${label} ${fmtRange(e.startDate, e.endDate)}`}
                        sx={{
                          all: onEventClick ? 'unset' : undefined,
                          boxSizing: 'border-box',
                          gridRow: 1,
                          gridColumn: `${s + 1} / ${last + 2}`,
                          alignSelf: 'center',
                          mx: '3px',
                          height: 28,
                          px: 1,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          cursor: onEventClick ? 'pointer' : 'default',
                          zIndex: 1,
                          color: pending ? e.color : '#fff',
                          bgcolor: pending ? alpha(e.color, 0.12) : e.color,
                          backgroundImage: pending ? `repeating-linear-gradient(45deg, ${alpha(e.color, 0.22)} 0 4px, transparent 4px 8px)` : undefined,
                          border: pending ? `1.5px dashed ${e.color}` : 'none',
                          transition: 'transform 120ms ease, box-shadow 120ms ease',
                          '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${alpha(e.color, 0.35)}` },
                          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} noWrap sx={{ fontSize: 11, color: 'inherit' }}>
                          {e.halfDay !== 'NONE' ? '½ ' : ''}
                          {e.leaveTypeName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Fragment>
          );
        })}
      </Box>
    </Box>
  );
}
