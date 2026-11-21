'use client';

import { Select } from '@/components/atoms';

/** How many years either side of the current year the year list offers. */
export const YEAR_SPAN = 5;

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' }),
}));

/**
 * The years to offer: the current year minus and plus YEAR_SPAN. The year on screen is always included, so the calendar can
 * show a year outside that range (reached by Next or Previous) and its year still shows as selected.
 */
export function yearOptions(currentYear: number, shownYear: number): { value: string; label: string }[] {
  const first = Math.min(currentYear - YEAR_SPAN, shownYear);
  const last = Math.max(currentYear + YEAR_SPAN, shownYear);

  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index)).map(year => ({
    value: year,
    label: year,
  }));
}

/**
 * The calendar's heading as two pickers: a month and a year, side by side. Each one is labelled for screen readers, and shows the
 * month and year on screen. Choosing either one moves the calendar to that month; Today, Previous and Next still work.
 */
export function MonthYearJump({ cursor, onMove }: { cursor: Date; onMove: (next: Date) => void }) {
  const month = cursor.getMonth();
  const year = cursor.getFullYear();
  const years = yearOptions(new Date().getFullYear(), year);

  return (
    <div className="cal-jump">
      <Select
        label="Month"
        hideLabel
        className="cal-jump__select"
        options={MONTHS}
        value={String(month)}
        onChange={value => {
          if (value !== null) {
            onMove(new Date(year, Number(value), 1));
          }
        }}
      />
      <Select
        label="Year"
        hideLabel
        className="cal-jump__select"
        options={years}
        value={String(year)}
        onChange={value => {
          if (value !== null) {
            onMove(new Date(Number(value), month, 1));
          }
        }}
      />
    </div>
  );
}
