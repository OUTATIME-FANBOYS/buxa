/** Short English names of the ISO weekdays, index 1 (Monday) to 7 (Sunday). */
const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * The days of a series as the Classes table shows them: a run of consecutive days reads "Mon to Fri", and any other set reads as a
 * comma list ("Mon, Wed"). The days are ISO weekdays (1 Monday to 7 Sunday). No days reads as "No days".
 */
export function seriesDaysLabel(weekdays: readonly number[]): string {
  const days = [...new Set(weekdays)].filter(d => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 0) {
    return 'No days';
  }
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (consecutive && days.length > 1) {
    return `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days[days.length - 1]]}`;
  }

  return days.map(d => DAY_NAMES[d]).join(', ');
}
