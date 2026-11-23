import type { AttendanceEntry } from '@buxa/contracts';
import { formatCampDateTime } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';

/** How many recent check-ins the tile lists. */
const RECENT_CHECK_INS = 5;

/**
 * The person's most recent check-ins, date and time, newest first (the service's order). Times are the camp's local time
 * (`timeZone`). Uses the visit history the page already loads; no query of its own.
 */
export function AttendanceHistory({
  entries,
  timeZone,
  clockFormat,
}: {
  entries: readonly AttendanceEntry[];
  timeZone: string;
  clockFormat: ClockFormat;
}) {
  const recent = entries.slice(0, RECENT_CHECK_INS);

  return (
    <section className="panel" aria-labelledby="attendance-heading">
      <h2 id="attendance-heading" className="people-heading">
        Attendance
      </h2>
      {recent.length === 0 ? (
        <p className="muted">No check-ins yet.</p>
      ) : (
        <ul className="people-list" aria-label="Recent check-ins">
          {recent.map(entry => (
            <li key={entry.id}>{formatCampDateTime(entry.checkedInAt, timeZone, clockFormat)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
