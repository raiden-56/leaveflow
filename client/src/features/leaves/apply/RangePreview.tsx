import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import type { DayBreakdown } from '@leaveflow/shared';
import { palette } from '@/theme/tokens';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid previewing the selected leave range: counted days, weekends and holidays. */
export function RangePreview({ days, color = palette.indigo }: { days: DayBreakdown[]; color?: string }) {
  const first = days[0]?.date;
  const [month, setMonth] = useState(() => dayjs(first ?? undefined).startOf('month'));
  useEffect(() => {
    if (first) setMonth(dayjs(first).startOf('month'));
  }, [first]);
  const map = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const start = month.startOf('week');
  const cells = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  const visibleCells = cells[35].month() !== month.month() ? cells.slice(0, 35) : cells;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <IconButton size="small" onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="Previous month"><ChevronLeft size={16} /></IconButton>
        <Typography variant="subtitle2">{month.format('MMMM YYYY')}</Typography>
        <IconButton size="small" onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="Next month"><ChevronRight size={16} /></IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {WEEKDAYS.map((d, i) => (
          <Typography key={i} variant="caption" color="text.secondary" textAlign="center" fontWeight={600}>{d}</Typography>
        ))}
        {visibleCells.map((d) => {
          const iso = d.format('YYYY-MM-DD');
          const info = map.get(iso);
          const inMonth = d.month() === month.month();
          const counted = info && info.counted > 0;
          const excluded = info && info.counted === 0;
          const label = info ? (info.reason === 'HOLIDAY' ? `Holiday: ${info.holidayName}` : info.reason === 'WEEKEND' ? 'Weekend – not counted' : info.counted === 0.5 ? 'Half day' : 'Leave day') : '';
          const cell = (
            <Box
              sx={{
                aspectRatio: '1',
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: counted ? 700 : 500,
                color: counted ? '#fff' : inMonth ? 'text.primary' : 'text.disabled',
                bgcolor: counted ? color : excluded ? alpha(info?.reason === 'HOLIDAY' ? palette.pending : palette.neutral, 0.15) : 'transparent',
                background: info?.counted === 0.5 ? `linear-gradient(135deg, ${color} 50%, ${alpha(color, 0.25)} 50%)` : undefined,
                border: excluded ? `1px dashed ${alpha(palette.neutral, 0.4)}` : '1px solid transparent',
                transition: 'background-color 200ms',
              }}
            >
              {d.date()}
            </Box>
          );
          return info ? <Tooltip key={iso} title={label}>{cell}</Tooltip> : <Box key={iso}>{cell}</Box>;
        })}
      </Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        <Legend color={color} label="Leave day" />
        <Legend color={alpha(palette.neutral, 0.3)} label="Weekend" dashed />
        <Legend color={alpha(palette.pending, 0.3)} label="Holiday" dashed />
      </Stack>
    </Box>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: color, border: dashed ? `1px dashed ${palette.neutral}` : 'none' }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}
