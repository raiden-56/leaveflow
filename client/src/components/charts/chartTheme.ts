import { useMemo } from 'react';
import { alpha, useTheme } from '@mui/material';
import { chartColors } from '@/theme/tokens';

/**
 * Dark-mode steps for series colours whose light-mode value falls below 3:1 contrast
 * on the dark surface (validated with the dataviz palette validator).
 */
const DARK_STEPS: Record<string, string> = {
  '#4F46E5': '#6366F1',
  '#2563EB': '#3B82F6',
  '#475569': '#94A3B8',
  '#64748B': '#94A3B8',
};

export function useChartTheme() {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  return useMemo(() => {
    const series = (color: string) => (dark ? DARK_STEPS[color.toUpperCase()] ?? DARK_STEPS[color] ?? color : color);
    return {
      dark,
      surface: theme.palette.background.paper,
      grid: alpha(theme.palette.text.secondary, dark ? 0.16 : 0.14),
      axis: theme.palette.text.secondary,
      text: theme.palette.text.primary,
      muted: theme.palette.text.secondary,
      cursor: alpha(theme.palette.text.secondary, 0.08),
      /** Categorical colour by fixed index (never cycled past the palette: callers fold extras into "Other"). */
      categorical: (i: number) => series(chartColors[Math.min(i, chartColors.length - 1)]),
      series,
      tick: { fill: theme.palette.text.secondary, fontSize: 12 },
    };
  }, [theme, dark]);
}

export type ChartTheme = ReturnType<typeof useChartTheme>;

/** Folds categories beyond `max` into a single "Other" slice (fixed-order hues are never cycled). */
export function foldOther<T extends { name: string; value: number; color?: string }>(items: T[], max = 7): (T | { name: string; value: number; color: string })[] {
  if (items.length <= max) return items;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rest = sorted.slice(max - 1).reduce((s, i) => s + i.value, 0);
  return [...sorted.slice(0, max - 1), { name: 'Other', value: rest, color: '#64748B' }];
}
