import type { ReactNode } from 'react';
import { Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { BarChart3 } from 'lucide-react';
import { SectionCard } from '../common/Layout';

export interface LegendItem {
  label: string;
  color: string;
  value?: ReactNode;
  /** Render the swatch hatched (e.g. pending). */
  hatched?: boolean;
}

/** HTML legend — identity is never carried by colour alone. Text uses ink tokens, not series colours. */
export function ChartLegend({ items, direction = 'row' }: { items: LegendItem[]; direction?: 'row' | 'column' }) {
  return (
    <Stack direction={direction} spacing={direction === 'row' ? 2 : 1} useFlexGap flexWrap="wrap" component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.map((i) => (
        <Stack key={i.label} component="li" direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '3px',
              flexShrink: 0,
              bgcolor: i.color,
              ...(i.hatched && { background: `repeating-linear-gradient(45deg, ${i.color}, ${i.color} 2px, transparent 2px, transparent 4px)`, border: `1px solid ${i.color}` }),
            }}
          />
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: direction === 'column' ? 1 : undefined }}>
            {i.label}
          </Typography>
          {i.value !== undefined && (
            <Typography variant="caption" fontWeight={700} color="text.primary">
              {i.value}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

interface TooltipRow {
  name?: string | number;
  value?: string | number | (string | number)[];
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/** Shared tooltip for every chart (pass as `content`). */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  labelFormatter?: (label: string) => ReactNode;
  valueFormatter?: (v: number) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={0} sx={{ px: 1.5, py: 1, border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: '0 8px 24px rgba(15,23,42,0.14)', minWidth: 140 }}>
      {label !== undefined && label !== '' && (
        <Typography variant="caption" fontWeight={700} component="div" sx={{ mb: 0.5 }}>
          {labelFormatter ? labelFormatter(String(label)) : label}
        </Typography>
      )}
      <Stack spacing={0.4}>
        {payload.map((p, i) => (
          <Stack key={`${p.dataKey ?? p.name}-${i}`} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: (p.payload?.color as string) ?? p.color }} />
              <Typography variant="caption" color="text.secondary">{p.name}</Typography>
            </Stack>
            <Typography variant="caption" fontWeight={700}>
              {valueFormatter && typeof p.value === 'number' ? valueFormatter(p.value) : Array.isArray(p.value) ? p.value.join(' – ') : p.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

interface ChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Plot height in px (the card grows with legend/footer). */
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  legend?: LegendItem[];
  footer?: ReactNode;
  children: ReactNode;
}

/** Card frame for a chart: title, actions, fixed plot height, loading skeleton and empty state. */
export function ChartCard({ title, subtitle, actions, height = 280, loading, empty, emptyText = 'No data for this period', legend, footer, children }: ChartCardProps) {
  return (
    <SectionCard title={title} subtitle={subtitle} action={actions}>
      {legend && legend.length > 1 && !loading && !empty && (
        <Box sx={{ mb: 1.5 }}>
          <ChartLegend items={legend} />
        </Box>
      )}
      <Box sx={{ height, position: 'relative' }}>
        {loading ? (
          <Skeleton variant="rounded" height={height} animation="wave" />
        ) : empty ? (
          <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', color: 'text.secondary' }}>
            <BarChart3 size={28} />
            <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
          </Stack>
        ) : (
          children
        )}
      </Box>
      {footer && !loading && <Box sx={{ mt: 1.5 }}>{footer}</Box>}
    </SectionCard>
  );
}
