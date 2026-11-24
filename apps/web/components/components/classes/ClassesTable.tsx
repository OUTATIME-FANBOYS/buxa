import type { Class } from '@buxa/contracts';
import { sessionPath } from '@/config/routes';
import { formatCampDateTime, priceSummary } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';
import { Button } from '@/components/elements';
import { ClassStatus } from './ClassStatus';
import { DeleteClassButton, EditClassButton, type InstructorChoice } from './forms';

/** The class's instructors by name, comma separated. A class with none says so. */
export const instructorNames = (cls: Pick<Class, 'instructors'>): string =>
  cls.instructors.length === 0 ? 'None yet' : cls.instructors.map(i => i.name).join(', ');

/**
 * The classes of one session, with their ages, camp size, times, location, instructors and seat counts. Times are the camp's own
 * clock. The enrolments link opens that class's enrolments on the same page (a query parameter, so it works without JavaScript).
 * Staff also get Edit and Delete for each class.
 */
export function ClassesTable({
  sessionId,
  sessionName,
  classes,
  timeZone,
  clockFormat,
  selectedId,
  canManage,
  canEdit,
  instructors,
}: {
  sessionId: string;
  sessionName: string;
  classes: readonly Class[];
  timeZone: string;
  clockFormat: ClockFormat;
  selectedId: string | null;
  canManage: boolean;
  /** Who may open a class's edit form: staff and above (all fields), or a teacher on its own class (the name only). */
  canEdit: boolean;
  instructors: readonly InstructorChoice[];
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Classes in this session, in camp time</caption>
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Ages</th>
            <th scope="col">Starts</th>
            <th scope="col">Ends</th>
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
          {classes.map(cls => {
            const selected = cls.id === selectedId;

            return (
              <tr key={cls.id}>
                <td>{cls.name}</td>
                <td>
                  {cls.ageRange.minAge} to {cls.ageRange.maxAge}
                </td>
                <td>{formatCampDateTime(cls.startsAt, timeZone, clockFormat)}</td>
                <td>{formatCampDateTime(cls.endsAt, timeZone, clockFormat)}</td>
                <td>{cls.location}</td>
                <td>{instructorNames(cls)}</td>
                <td>{cls.capacity}</td>
                <td>{priceSummary(cls.price, timeZone)}</td>
                <td>{cls.seatsTaken}</td>
                <td>{cls.waitlisted}</td>
                <td>
                  <ClassStatus cls={cls} />
                </td>
                <td>
                  <div className="classes-row-actions">
                    <Button
                      variant="glass"
                      size="sm"
                      iconOnly
                      icon="users"
                      aria-label={`Enrolments for ${cls.name}`}
                      title={selected ? 'Showing enrolments' : 'Enrolments'}
                      aria-current={selected ? 'true' : undefined}
                      href={`${sessionPath(sessionId)}?class=${encodeURIComponent(cls.id)}#enrolments`}
                    />
                    {canEdit && (
                      <EditClassButton
                        cls={cls}
                        sessionName={sessionName}
                        instructors={instructors}
                        detailsOnly={!canManage}
                      />
                    )}
                    {canManage && <DeleteClassButton classId={cls.id} sessionId={sessionId} className={cls.name} />}
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
