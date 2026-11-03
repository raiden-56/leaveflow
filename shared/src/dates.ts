import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import type { DayBreakdown, HalfDay } from './types';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const ISO_DATE = 'YYYY-MM-DD';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value) && dayjs(value, ISO_DATE, true).isValid();
}

/** Today's calendar date in the organisation's timezone. */
export function todayIso(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return dayjs(now).tz(tz).format(ISO_DATE);
}

export function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format(ISO_DATE);
}

export function diffDays(from: string, to: string): number {
  return dayjs(to).diff(dayjs(from), 'day');
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of ISO dates between start and end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = dayjs(start);
  const last = dayjs(end);
  while (!cursor.isAfter(last, 'day')) {
    out.push(cursor.format(ISO_DATE));
    cursor = cursor.add(1, 'day');
  }
  return out;
}

/** Inclusive date range overlap. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export interface LeaveDayInput {
  startDate: string;
  endDate: string;
  halfDay: HalfDay;
  /** Weekday numbers (0=Sun..6=Sat) that are working days. */
  workingDays: number[];
  /** Public/company holidays that are non-working days. */
  holidays: { holidayDate: string; holidayName: string }[];
  /** When false every calendar day counts (e.g. maternity leave). */
  excludeNonWorkingDays: boolean;
}

export interface LeaveDayResult {
  totalDays: number;
  days: DayBreakdown[];
}

/**
 * Calculates chargeable leave days for a date range, excluding weekends and
 * holidays according to policy. A half day is only valid for single-day leave.
 */
export function calculateLeaveDays(input: LeaveDayInput): LeaveDayResult {
  const { startDate, endDate, halfDay, workingDays, holidays, excludeNonWorkingDays } = input;
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
    return { totalDays: 0, days: [] };
  }
  const holidayMap = new Map(holidays.map((h) => [h.holidayDate, h.holidayName]));
  const workingSet = new Set(workingDays);
  const days: DayBreakdown[] = eachDay(startDate, endDate).map((date) => {
    if (excludeNonWorkingDays) {
      const holidayName = holidayMap.get(date);
      if (holidayName) return { date, counted: 0, reason: 'HOLIDAY', holidayName };
      if (!workingSet.has(dayjs(date).day())) return { date, counted: 0, reason: 'WEEKEND' };
    }
    return { date, counted: 1 };
  });

  if (halfDay !== 'NONE' && startDate === endDate && days[0] && days[0].counted === 1) {
    days[0] = { ...days[0], counted: 0.5 };
  }
  const totalDays = days.reduce((sum, d) => sum + d.counted, 0);
  return { totalDays, days };
}

/** Number of consecutive calendar days the employee is away (for max-consecutive policies). */
export function calendarSpan(startDate: string, endDate: string): number {
  return diffDays(startDate, endDate) + 1;
}

export function formatDisplayDate(date: string, format = 'DD MMM YYYY'): string {
  return date ? dayjs(date).format(format) : '';
}

export { dayjs };
