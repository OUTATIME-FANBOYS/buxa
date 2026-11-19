import { parseDate, toCalendarDate, type CalendarDate, type DateValue } from '@internationalized/date';

/*
 * The boundary between the DatePicker atom and the server. The server's contracts (packages/contracts, LocalDateSchema)
 * take a YYYY-MM-DD string, so a form converts with these two functions and never hands a CalendarDate to an action.
 */

/** The YYYY-MM-DD string for a picked date, or '' when nothing is picked (what an empty native date field submitted). */
export function formatLocalDate(value: DateValue | null | undefined): string {
  return value ? toCalendarDate(value).toString() : '';
}

/** The calendar date for a YYYY-MM-DD string, or null when it is empty or not a real date. */
export function parseLocalDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}
