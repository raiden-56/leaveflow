import { useId, useState, type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartLegend, ChartTooltip } from './ChartParts';
import { useChartTheme } from './chartTheme';

/**
 * Recharts wrappers with one visual language:
 *  - thin marks, 4px rounded data-ends anchored at the baseline, 2px lines
 *  - 2px surface gap between stacked segments / pie slices
 *  - recessive grid (horizontal only) and axes, single y-axis
 *  - hover tooltip on every chart; legend whenever there are >= 2 series
 */

export interface Series {
  key: string;
  label: string;
  /** Defaults to the categorical palette by series index. */
  color?: string;
}

interface CartesianProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  height?: number | string;
  valueFormatter?: (v: number) => string;
  xFormatter?: (v: string) => string;
  /** Show the HTML legend above the plot (defaults to series.length > 1). */
  legend?: boolean;
  yWidth?: number;
}

function useSeriesColors(series: Series[]) {
  const ct = useChartTheme();
  return series.map((s, i) => ct.series(s.color ?? ct.categorical(i)));
}

function Legend({ series, colors }: { series: Series[]; colors: string[] }) {
  return (
    <Box sx={{ mb: 1 }}>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />
    </Box>
  );
}

function Frame({ legend, children, height }: { legend?: ReactNode; children: ReactNode; height: number | string }) {
  return (
    <Stack sx={{ height, width: '100%', minWidth: 0 }}>
      {legend}
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Stack>
  );
}

export function BarChart<T extends object>({
  data,
  xKey,
  series,
  height = '100%',
  valueFormatter,
  xFormatter,
  legend,
  stacked,
  horizontal,
  yWidth = 40,
}: CartesianProps<T> & { stacked?: boolean; horizontal?: boolean }) {
  const ct = useChartTheme();
  const colors = useSeriesColors(series);
  const showLegend = legend ?? series.length > 1;
  return (
    <Frame height={height} legend={showLegend && <Legend series={series} colors={colors} />}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={ct.grid} vertical={Boolean(horizontal)} horizontal={!horizontal} />
          {/* Axes must be direct children of the chart: Recharts 2 doesn't look inside Fragments. */}
          {horizontal ? (
            <XAxis type="number" tick={ct.tick} axisLine={false} tickLine={false} tickFormatter={valueFormatter} allowDecimals={false} />
          ) : (
            <XAxis dataKey={xKey} tick={ct.tick} axisLine={{ stroke: ct.grid }} tickLine={false} tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
          )}
          {horizontal ? (
            <YAxis type="category" dataKey={xKey} tick={ct.tick} axisLine={false} tickLine={false} width={yWidth} tickFormatter={xFormatter} />
          ) : (
            <YAxis tick={ct.tick} axisLine={false} tickLine={false} width={yWidth} tickFormatter={valueFormatter} allowDecimals={false} />
          )}
          <Tooltip cursor={{ fill: ct.cursor }} content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={xFormatter} />} />
          {series.map((s, i) => {
            const last = i === series.length - 1;
            // Only the outermost stacked segment gets rounded ends, anchored away from the baseline.
            const r = stacked && !last ? 0 : 4;
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={colors[i]}
                stackId={stacked ? 'stack' : undefined}
                maxBarSize={horizontal ? 18 : 28}
                radius={horizontal ? [0, r, r, 0] : [r, r, 0, 0]}
                stroke={stacked ? ct.surface : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive
                animationDuration={700}
              />
            );
          })}
        </RBarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function LineChart<T extends object>({ data, xKey, series, height = '100%', valueFormatter, xFormatter, legend, yWidth = 40 }: CartesianProps<T>) {
  const ct = useChartTheme();
  const colors = useSeriesColors(series);
  const showLegend = legend ?? series.length > 1;
  return (
    <Frame height={height} legend={showLegend && <Legend series={series} colors={colors} />}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={ct.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={ct.tick} axisLine={{ stroke: ct.grid }} tickLine={false} tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={ct.tick} axisLine={false} tickLine={false} width={yWidth} tickFormatter={valueFormatter} allowDecimals={false} />
          <Tooltip cursor={{ stroke: ct.muted, strokeDasharray: '3 3' }} content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={xFormatter} />} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colors[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: ct.surface, strokeWidth: 2 }}
              animationDuration={800}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function AreaChart<T extends object>({ data, xKey, series, height = '100%', valueFormatter, xFormatter, legend, stacked, yWidth = 40 }: CartesianProps<T> & { stacked?: boolean }) {
  const ct = useChartTheme();
  const colors = useSeriesColors(series);
  const gid = useId().replace(/:/g, '');
  const showLegend = legend ?? series.length > 1;
  return (
    <Frame height={height} legend={showLegend && <Legend series={series} colors={colors} />}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[i]} stopOpacity={stacked ? 0.55 : 0.28} />
                <stop offset="100%" stopColor={colors[i]} stopOpacity={stacked ? 0.25 : 0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={ct.grid} vertical={false} />
          <XAxis dataKey={xKey} tick={ct.tick} axisLine={{ stroke: ct.grid }} tickLine={false} tickFormatter={xFormatter} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={ct.tick} axisLine={false} tickLine={false} width={yWidth} tickFormatter={valueFormatter} allowDecimals={false} />
          <Tooltip cursor={{ stroke: ct.muted, strokeDasharray: '3 3' }} content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={xFormatter} />} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'stack' : undefined}
              stroke={colors[i]}
              strokeWidth={2}
              fill={`url(#${gid}-${i})`}
              activeDot={{ r: 5, stroke: ct.surface, strokeWidth: 2 }}
              animationDuration={800}
            />
          ))}
        </RAreaChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export interface PieDatum {
  name: string;
  value: number;
  /** Defaults to the categorical palette by index. */
  color?: string;
}

interface PieProps {
  data: PieDatum[];
  height?: number | string;
  valueFormatter?: (v: number) => string;
  /** Show the legend beside (wide) or below (narrow) the pie. Default true. */
  legend?: boolean;
  legendPosition?: 'right' | 'bottom';
}

function PieBase({ data, height = '100%', valueFormatter, legend = true, legendPosition = 'right', donut, centerValue, centerLabel }: PieProps & { donut?: boolean; centerValue?: ReactNode; centerLabel?: ReactNode }) {
  const ct = useChartTheme();
  const [active, setActive] = useState<number | null>(null);
  const items = data.filter((d) => d.value > 0).map((d, i) => ({ ...d, color: ct.series(d.color ?? ct.categorical(i)) }));
  const total = items.reduce((s, d) => s + d.value, 0);
  const fmt = (v: number) => (valueFormatter ? valueFormatter(v) : String(v));
  return (
    <Stack direction={legendPosition === 'right' ? { xs: 'column', sm: 'row' } : 'column'} spacing={2} alignItems="center" sx={{ height, width: '100%', minWidth: 0 }}>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 160, width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius={donut ? '62%' : 0}
              outerRadius="92%"
              paddingAngle={items.length > 1 ? 1 : 0}
              stroke={ct.surface}
              strokeWidth={2}
              cornerRadius={donut ? 4 : 0}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={800}
            >
              {items.map((d, i) => (
                <Cell key={d.name} fill={d.color} fillOpacity={active === null || active === i ? 1 : 0.45} />
              ))}
            </Pie>
          </RPieChart>
        </ResponsiveContainer>
        {donut && (centerValue !== undefined || centerLabel) && (
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Typography variant="h5" lineHeight={1}>{centerValue ?? fmt(total)}</Typography>
            {centerLabel && <Typography variant="caption" color="text.secondary">{centerLabel}</Typography>}
          </Stack>
        )}
      </Box>
      {legend && (
        <Box sx={{ width: legendPosition === 'right' ? { xs: '100%', sm: 200 } : '100%', flexShrink: 0 }}>
          <ChartLegend
            direction="column"
            items={items.map((d) => ({ label: d.name, color: d.color, value: `${fmt(d.value)}${total ? ` · ${Math.round((d.value / total) * 100)}%` : ''}` }))}
          />
        </Box>
      )}
    </Stack>
  );
}

export const PieChart = (props: PieProps) => <PieBase {...props} />;

export const DonutChart = (props: PieProps & { centerValue?: ReactNode; centerLabel?: ReactNode }) => <PieBase {...props} donut />;
