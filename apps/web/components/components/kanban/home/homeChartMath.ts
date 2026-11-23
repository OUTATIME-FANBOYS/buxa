import type { DayCount } from '@buxa/shared/camp/campHomeTypes';

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
    if (busiest === null || day.count > busiest.count) {
      busiest = day;
    }
  }

  return { total, busiest: busiest && busiest.count > 0 ? busiest : null };
}
