import { describe, expect, it } from 'vitest';
import { calculateLeaveDays, eachDay, isIsoDate, rangesOverlap, todayIso, calendarSpan } from '../dates';

const base = { workingDays: [1, 2, 3, 4, 5], holidays: [], halfDay: 'NONE' as const, excludeNonWorkingDays: true };

describe('calculateLeaveDays', () => {
  it('counts working days and excludes weekends', () => {
    // Fri 6 Nov 2026 → Tue 10 Nov 2026 = Fri, Mon, Tue
    const r = calculateLeaveDays({ ...base, startDate: '2026-11-06', endDate: '2026-11-10' });
    expect(r.totalDays).toBe(3);
    expect(r.days.filter((d) => d.reason === 'WEEKEND')).toHaveLength(2);
  });

  it('excludes configured public holidays', () => {
    const r = calculateLeaveDays({ ...base, startDate: '2026-11-09', endDate: '2026-11-11', holidays: [{ holidayDate: '2026-11-09', holidayName: 'Diwali' }] });
    expect(r.totalDays).toBe(2);
    expect(r.days[0]).toMatchObject({ reason: 'HOLIDAY', holidayName: 'Diwali', counted: 0 });
  });

  it('supports half days for single-day leave only', () => {
    expect(calculateLeaveDays({ ...base, startDate: '2026-11-04', endDate: '2026-11-04', halfDay: 'FIRST_HALF' }).totalDays).toBe(0.5);
    expect(calculateLeaveDays({ ...base, startDate: '2026-11-04', endDate: '2026-11-05', halfDay: 'FIRST_HALF' }).totalDays).toBe(2);
  });

  it('a half day on a weekend counts nothing', () => {
    expect(calculateLeaveDays({ ...base, startDate: '2026-11-07', endDate: '2026-11-07', halfDay: 'SECOND_HALF' }).totalDays).toBe(0);
  });

  it('counts calendar days when the policy does not exclude non-working days (maternity)', () => {
    const r = calculateLeaveDays({ ...base, excludeNonWorkingDays: false, startDate: '2026-11-06', endDate: '2026-11-15' });
    expect(r.totalDays).toBe(10);
  });

  it('honours custom working weeks (6-day week)', () => {
    const r = calculateLeaveDays({ ...base, workingDays: [1, 2, 3, 4, 5, 6], startDate: '2026-11-06', endDate: '2026-11-09' });
    expect(r.totalDays).toBe(3); // Fri, Sat, Mon
  });

  it('returns zero for invalid or reversed ranges', () => {
    expect(calculateLeaveDays({ ...base, startDate: '2026-11-10', endDate: '2026-11-01' }).totalDays).toBe(0);
    expect(calculateLeaveDays({ ...base, startDate: 'not-a-date', endDate: '2026-11-01' }).totalDays).toBe(0);
  });
});

describe('date helpers', () => {
  it('detects inclusive overlaps', () => {
    expect(rangesOverlap('2026-11-01', '2026-11-05', '2026-11-05', '2026-11-09')).toBe(true);
    expect(rangesOverlap('2026-11-01', '2026-11-04', '2026-11-05', '2026-11-09')).toBe(false);
  });
  it('enumerates days across month boundaries', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(calendarSpan('2026-10-30', '2026-11-02')).toBe(4);
  });
  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('28-02-2026')).toBe(false);
  });
  it('computes today in the organisation timezone', () => {
    // 20:00 UTC on 3 Nov is already 4 Nov in India
    expect(todayIso('Asia/Kolkata', new Date('2026-11-03T20:00:00Z'))).toBe('2026-11-04');
    expect(todayIso('UTC', new Date('2026-11-03T20:00:00Z'))).toBe('2026-11-03');
  });
});
