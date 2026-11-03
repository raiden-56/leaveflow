import { Box, Card, Tooltip, Typography, alpha } from '@mui/material';
import dayjs from 'dayjs';

export interface MarkedDay {
  date: string;
  color: string;
  label: string;
}

interface MonthGridProps {
  /** Any date inside the month to render (YYYY-MM-DD or YYYY-MM). */
  month: string;
  marks: MarkedDay[];
  /** Weekday numbers (0=Sun) rendered as non-working. */
  workingDays?: number[];
  today?: string;
  onDayClick?: (date: string, marks: MarkedDay[]) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Compact month calendar (Monday-first) that highlights marked days with tooltips. */
export function MonthGrid({ month, marks, workingDays = [1, 2, 3, 4, 5], today, onDayClick }: MonthGridProps) {
  const first = dayjs(month.length === 7 ? `${month}-01` : month).startOf('month');
  const offset = (first.day() + 6) % 7; // Monday-first
  const days = first.daysInMonth();
  const byDate = new Map<string, MarkedDay[]>();
  marks.forEach((m) => byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]));
  const cells: (string | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, i) => first.add(i, 'day').format('YYYY-MM-DD'))];
  const count = marks.filter((m) => m.date.startsWith(first.format('YYYY-MM'))).length;

  return (
    <Card sx={{ p: 1.75, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
        <Typography variant="subtitle2">{first.format('MMMM')}</Typography>
        <Typography variant="caption" color="text.secondary">{count ? `${count} holiday${count > 1 ? 's' : ''}` : ''}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }} role="grid" aria-label={first.format('MMMM YYYY')}>
        {WEEKDAYS.map((w, i) => (
          <Typography key={i} variant="caption" color="text.disabled" sx={{ textAlign: 'center', fontWeight: 600 }}>{w}</Typography>
        ))}
        {cells.map((date, i) => {
          if (!date) return <Box key={`e${i}`} />;
          const dayMarks = byDate.get(date) ?? [];
          const weekend = !workingDays.includes(dayjs(date).day());
          const mark = dayMarks[0];
          const isToday = date === today;
          const cell = (
            <Box
              role="gridcell"
              aria-label={`${dayjs(date).format('D MMMM')}${dayMarks.length ? `: ${dayMarks.map((m) => m.label).join(', ')}` : ''}`}
              onClick={onDayClick && dayMarks.length ? () => onDayClick(date, dayMarks) : undefined}
              sx={{
                aspectRatio: '1',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                fontSize: 12,
                fontWeight: mark || isToday ? 700 : 400,
                cursor: mark && onDayClick ? 'pointer' : 'default',
                color: mark ? '#fff' : weekend ? 'text.disabled' : 'text.primary',
                bgcolor: mark ? mark.color : weekend ? (t) => alpha(t.palette.text.secondary, 0.06) : 'transparent',
                outline: isToday ? '2px solid' : 'none',
                outlineColor: 'primary.main',
                transition: 'transform 120ms ease',
                '&:hover': mark ? { transform: 'scale(1.12)' } : undefined,
              }}
            >
              {dayjs(date).date()}
            </Box>
          );
          return mark ? (
            <Tooltip key={date} title={dayMarks.map((m) => m.label).join(' · ')} arrow>
              {cell}
            </Tooltip>
          ) : (
            <Box key={date}>{cell}</Box>
          );
        })}
      </Box>
    </Card>
  );
}
