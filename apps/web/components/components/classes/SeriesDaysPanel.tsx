import type { Class } from '@buxa/contracts';
import { formatCampDateTime } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';
import { Pill } from '@/components/elements';
import { CancelDayButton, RestoreDayButton } from './forms';

/**
 * The days of one series, in order: each day's date and time, and whether it is active or cancelled. A cancelled day shows its
 * reason. Staff cancel an active day (with a reason) and restore a cancelled one; everyone else reads the list.
 */
export function SeriesDaysPanel({
  sessionId,
  seriesName,
  days,
  timeZone,
  clockFormat,
  canManage,
}: {
  sessionId: string;
  seriesName: string;
  days: readonly Class[];
  timeZone: string;
  clockFormat: ClockFormat;
  canManage: boolean;
}) {
  const cancelled = days.filter(d => d.occurrenceStatus === 'cancelled').length;

  return (
    <section id="days" aria-labelledby="days-heading" className="stack classes-enrolments">
      <h2 id="days-heading" className="people-subheading">
        Days of {seriesName}
      </h2>
      <p aria-live="polite" className="muted">
        {days.length - cancelled} of {days.length} {days.length === 1 ? 'day' : 'days'} active
        {cancelled > 0 ? `, ${cancelled} cancelled` : ''}.
      </p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Each day of {seriesName}, in camp time</caption>
          <thead>
            <tr>
              <th scope="col">Starts</th>
              <th scope="col">Ends</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const isCancelled = day.occurrenceStatus === 'cancelled';
              const label = formatCampDateTime(day.startsAt, timeZone, clockFormat);

              return (
                <tr key={day.id}>
                  <td>{label}</td>
                  <td>{formatCampDateTime(day.endsAt, timeZone, clockFormat)}</td>
                  <td>
                    {isCancelled ? (
                      <>
                        <Pill tone="warn">Cancelled</Pill>
                        {day.cancelReason && <span className="muted"> {day.cancelReason}</span>}
                      </>
                    ) : (
                      <Pill tone="ok">Active</Pill>
                    )}
                  </td>
                  <td>
                    {canManage &&
                      (isCancelled ? (
                        <RestoreDayButton occurrenceId={day.id} sessionId={sessionId} dayLabel={label} />
                      ) : (
                        <CancelDayButton occurrenceId={day.id} sessionId={sessionId} dayLabel={label} />
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
