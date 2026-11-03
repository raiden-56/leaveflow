import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayjs, eachDay, type CalendarLeaveEvent, type Holiday } from '@leaveflow/shared';

export interface DayMarker {
  date: string;
  color: string;
  label?: string;
}

export interface MiniMonthCalendarProps {
  /** Initially shown month (YYYY-MM). Defaults to the month of `today`. */
  month?: string;
  /** Dots under days (max 3 shown per day); labels appear in the tooltip. */
  markers?: DayMarker[];
  today?: string;
  selected?: string;
  onSelect?: (date: string) => void;
  /** Called with YYYY-MM when the user navigates (e.g. to refetch). */
  onMonthChange?: (month: string) => void;
  /** Weekday the grid starts on (1 = Monday, default). */
  weekStart?: 0 | 1;
}

/** Builds markers from leave events (one per day of each event) and holidays. */
export function buildMarkers(events: CalendarLeaveEvent[] = [], holidays: Pick<Holiday, 'holidayDate' | 'holidayName'>[] = [], holidayColor = '#DC2626'): DayMarker[] {
  const out: DayMarker[] = holidays.map((h) => ({ date: h.holidayDate, color: holidayColor, label: h.holidayName }));
  for (const e of events) {
    for (const date of eachDay(e.startDate, e.endDate)) {
      out.push({ date, color: e.color, label: `${e.employeeName} – ${e.leaveTypeName}${e.status !== 'APPROVED' ? ' (pending)' : ''}` });
    }
  }
  return out;
}

/** Compact month grid with coloured dots for leave and holidays. */
export function MiniMonthCalendar({ month, markers = [], today, selected, onSelect, onMonthChange, weekStart = 1 }: MiniMonthCalendarProps) {
  const theme = useTheme();
  const todayStr = today ?? dayjs().format('YYYY-MM-DD');
  const [current, setCurrent] = useState(month ?? todayStr.slice(0, 7));
  useEffect(() => {
    if (month) setCurrent(month);
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, DayMarker[]>();
    for (const m of markers) map.set(m.date, [...(map.get(m.date) ?? []), m]);
    return map;
  }, [markers]);

  const first = dayjs(`${current}-01`);
  const offset = (first.day() - weekStart + 7) % 7;
  const gridStart = first.subtract(offset, 'day');
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  const visibleCells = cells[35].month() !== first.month() ? cells.slice(0, 35) : cells;
  const weekdays = Array.from({ length: 7 }, (_, i) => dayjs().day((i + weekStart) % 7).format('dd'));

  const go = (delta: number) => {
    const next = first.add(delta, 'month').format('YYYY-MM');
    setCurrent(next);
    onMonthChange?.(next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">{first.format('MMMM YYYY')}</Typography>
        <Stack direction="row">
          <IconButton size="small" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={16} /></IconButton>
          <IconButton size="small" onClick={() => go(1)} aria-label="Next month"><ChevronRight size={16} /></IconButton>
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25, textAlign: 'center' }} role="grid" aria-label={first.format('MMMM YYYY')}>
        {weekdays.map((w) => (
          <Typography key={w} variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11, py: 0.5 }}>{w}</Typography>
        ))}
        {visibleCells.map((d) => {
          const iso = d.format('YYYY-MM-DD');
          const inMonth = d.month() === first.month();
          const dayMarkers = byDate.get(iso) ?? [];
          const isToday = iso === todayStr;
          const isSelected = iso === selected;
          const weekend = d.day() === 0 || d.day() === 6;
          const colors = [...new Set(dayMarkers.map((m) => m.color))].slice(0, 3);
          const content = (
            <Box
              component={onSelect ? 'button' : 'div'}
              onClick={onSelect ? () => onSelect(iso) : undefined}
              role="gridcell"
              aria-label={`${d.format('DD MMMM')}${dayMarkers.length ? `, ${dayMarkers.length} event(s)` : ''}`}
              sx={{
                all: onSelect ? 'unset' : undefined,
                boxSizing: 'border-box',
                height: 36,
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onSelect ? 'pointer' : 'default',
                opacity: inMonth ? 1 : 0.35,
                bgcolor: isSelected ? 'primary.main' : isToday ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                color: isSelected ? '#fff' : weekend ? 'text.secondary' : 'text.primary',
                '&:hover': onSelect ? { bgcolor: isSelected ? 'primary.main' : 'action.hover' } : undefined,
              }}
            >
              <Typography variant="caption" fontWeight={isToday || isSelected ? 800 : 500} sx={{ lineHeight: 1.4, color: 'inherit' }}>{d.date()}</Typography>
              <Stack direction="row" spacing={0.25} sx={{ height: 5 }}>
                {colors.map((c) => (
                  <Box key={c} sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isSelected ? '#fff' : c }} />
                ))}
              </Stack>
            </Box>
          );
          return dayMarkers.length ? (
            <Tooltip key={iso} title={<Box>{dayMarkers.slice(0, 6).map((m, i) => <div key={i}>{m.label}</div>)}{dayMarkers.length > 6 && <div>+{dayMarkers.length - 6} more</div>}</Box>}>
              {content}
            </Tooltip>
          ) : (
            <Box key={iso}>{content}</Box>
          );
        })}
      </Box>
    </Box>
  );
}
