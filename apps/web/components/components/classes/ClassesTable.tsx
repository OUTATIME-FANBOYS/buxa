import type { Series } from '@buxa/contracts';
import { sessionPath } from '@/config/routes';
import { priceSummary, seriesDaysLabel } from '@buxa/shared';
import { Button, Pill } from '@/components/elements';
import { seatFor, seatsLeft } from '@buxa/domain';
import { DeleteClassButton, EditSeriesButton, type InstructorChoice } from './forms';

/** The series' instructors by name, comma separated. A series with none says so. */
export const instructorNames = (series: Pick<Series, 'instructors'>): string =>
  series.instructors.length === 0 ? 'None yet' : series.instructors.map(i => i.name).join(', ');

/** Places left as a word: "3 left", or "Full" (with a waitlist when people wait). */
export function placesLabel(series: Pick<Series, 'capacity' | 'seatsTaken' | 'waitlisted'>): {
  label: string;
  tone: 'ok' | 'warn';
} {
  if (seatFor(series.capacity, series.seatsTaken).kind === 'full') {
    return { label: series.waitlisted > 0 ? 'Full, with a waitlist' : 'Full', tone: 'warn' };
  }

  return { label: `${seatsLeft(series.capacity, series.seatsTaken)} left`, tone: 'ok' };
}

/**
 * The class series of one session, one row each: name, ages, days, times, location, instructors, camp size, price, enrolled,
 * waitlisted and places. The times are the first day's clock times in camp time. Days opens the series' own days (cancel and restore
 * one day at a time); Enrolments opens the series' enrolments on the same page. Staff also get Edit and Delete for the series.
 */
export function ClassesTable({
  sessionId,
  sessionName,
  series,
  timeZone,
  selectedId,
  daysId,
  canManage,
  canEdit,
  instructors,
}: {
  sessionId: string;
  sessionName: string;
  series: readonly Series[];
  timeZone: string;
  /** The anchor occurrence of the series whose enrolments are open, if any. */
  selectedId: string | null;
  /** The series whose days are open, if any. */
  daysId: string | null;
  canManage: boolean;
  /** Who may open a series' edit form: staff and above (all fields), or a teacher on the series (the name only). */
  canEdit: boolean;
  instructors: readonly InstructorChoice[];
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Classes in this session, one row per class series, in camp time</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Ages</th>
            <th scope="col">Days</th>
            <th scope="col">Times</th>
            <th scope="col">Location</th>
            <th scope="col">Instructors</th>
            <th scope="col">Camp Size</th>
            <th scope="col">Price</th>
            <th scope="col">Enrolled</th>
            <th scope="col">Waitlisted</th>
            <th scope="col">Places</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {series.map(s => {
            const enrolmentsOpen = s.anchorClassId === selectedId;
            const daysOpen = s.id === daysId;
            const places = placesLabel(s);

            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  {s.ageRange.minAge} to {s.ageRange.maxAge}
                </td>
                <td>{seriesDaysLabel(s.weekdays)}</td>
                <td>
                  {s.startTime} to {s.endTime}
                </td>
                <td>{s.location}</td>
                <td>{instructorNames(s)}</td>
                <td>{s.capacity}</td>
                <td>{priceSummary(s.price, timeZone)}</td>
                <td>{s.seatsTaken}</td>
                <td>{s.waitlisted}</td>
                <td>
                  <Pill tone={places.tone}>{places.label}</Pill>
                </td>
                <td>
                  <div className="classes-row-actions">
                    <Button
                      variant="glass"
                      size="sm"
                      aria-current={daysOpen ? 'true' : undefined}
                      href={`${sessionPath(sessionId)}?days=${encodeURIComponent(s.id)}#days`}
                    >
                      Days
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      iconOnly
                      icon="users"
                      aria-label={`Enrolments for ${s.name}`}
                      title={enrolmentsOpen ? 'Showing enrolments' : 'Enrolments'}
                      aria-current={enrolmentsOpen ? 'true' : undefined}
                      href={`${sessionPath(sessionId)}?class=${encodeURIComponent(s.anchorClassId)}#enrolments`}
                    />
                    {canEdit && (
                      <EditSeriesButton
                        series={s}
                        sessionName={sessionName}
                        instructors={instructors}
                        detailsOnly={!canManage}
                      />
                    )}
                    {canManage && <DeleteClassButton seriesId={s.id} sessionId={sessionId} className={s.name} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
