import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { HALF_DAY_LABELS, type HalfDay } from '@leaveflow/shared';

dayjs.extend(relativeTime);

export const fmtDate = (d?: string, f = 'DD MMM YYYY') => (d ? dayjs(d).format(f) : '—');
export const fmtShort = (d?: string) => fmtDate(d, 'DD MMM');
export const fmtDateTime = (d?: string) => (d ? dayjs(d).format('DD MMM YYYY, hh:mm A') : '—');
export const fromNow = (d?: string) => (d ? dayjs(d).fromNow() : '');
export const fmtMonth = (ym: string) => dayjs(`${ym}-01`).format('MMM YY');

export function fmtRange(start: string, end: string): string {
  if (!start) return '—';
  if (start === end) return fmtDate(start);
  const s = dayjs(start);
  const e = dayjs(end);
  if (s.year() === e.year()) return `${s.format(s.month() === e.month() ? 'DD' : 'DD MMM')} – ${e.format('DD MMM YYYY')}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

export function fmtDays(n: number, halfDay?: HalfDay): string {
  const label = `${n} ${n === 1 ? 'day' : 'days'}`;
  return halfDay && halfDay !== 'NONE' ? `${label} (${HALF_DAY_LABELS[halfDay].toLowerCase()})` : label;
}

export function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const AVATAR_COLORS = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#2563EB', '#7C3AED', '#0891B2', '#16A34A', '#EA580C'];
export function colorFor(seed?: string): string {
  if (!seed) return AVATAR_COLORS[0];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Client-side CSV export of any table. */
export function exportCsv<T>(fileName: string, rows: T[], columns: { header: string; value: (r: T) => unknown }[]): void {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}-${dayjs().format('YYYYMMDD')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
