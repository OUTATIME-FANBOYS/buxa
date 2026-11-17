import type { DayCount, MembershipStatusCounts } from '@buxa/shared/camp/campHomeTypes';

/** The ranges the check-in chart offers, in days, ending today. */
export const CHECK_IN_RANGES = [7, 14, 30] as const;
export type CheckInRange = (typeof CHECK_IN_RANGES)[number];

/** The last `range` days of the series, oldest first. */
export const lastDays = (days: readonly DayCount[], range: number): DayCount[] => days.slice(-range);

/** Day of the month, for an axis label. The full date is in the table alternative. */
export const dayOfMonth = (date: string): string => String(Number(date.slice(8, 10)));

/** A readable date for a summary or table, such as "12 Nov". Works on the calendar date alone, so no zone shifts it. */
export const shortDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The total and the busiest day (the first, when days tie). */
export function chartTotals(days: readonly DayCount[]): { total: number; busiest: DayCount | null } {
  let busiest: DayCount | null = null;
  let total = 0;
  for (const day of days) {
    total += day.count;
    if (busiest === null || day.count > busiest.count) busiest = day;
  }
  return { total, busiest: busiest && busiest.count > 0 ? busiest : null };
}

/** Which bars get an axis label: every bar for up to 14 days, then every third, always the last. */
export const showAxisLabel = (index: number, count: number): boolean =>
  index === count - 1 || index % (count > 14 ? 3 : 1) === 0;

export interface DonutSegment { key: keyof MembershipStatusCounts; label: string; count: number; percent: number; dash: number; offset: number }

/** The donut's segments in a fixed order, skipping empty ones. `length` is the ring's circumference; dash and offset are in the same units. */
export function donutSegments(counts: MembershipStatusCounts, length: number): DonutSegment[] {
  const order: { key: keyof MembershipStatusCounts; label: string }[] = [
    { key: 'valid', label: 'Valid' },
    { key: 'notStarted', label: 'Not started' },
    { key: 'expired', label: 'Expired' },
    { key: 'none', label: 'None (includes revoked)' },
  ];
  const total = order.reduce((sum, o) => sum + counts[o.key], 0);
  if (total === 0) return [];
  let cumulative = 0;
  const segments: DonutSegment[] = [];
  for (const { key, label } of order) {
    const count = counts[key];
    if (count === 0) continue;
    const dash = (count / total) * length;
    segments.push({ key, label, count, percent: Math.round((count / total) * 100), dash, offset: -cumulative });
    cumulative += dash;
  }
  return segments;
}
