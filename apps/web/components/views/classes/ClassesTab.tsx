import type { Class, Session } from '@buxa/contracts';
import { can, seatFor, type Actor } from '@buxa/domain';
import { sessionPath } from '@/config/routes';
import { Empty, Notice } from '@/components/components';
import { campClock, loadActiveHolds, loadEnrolments, loadPeopleWithRole } from '@buxa/server/composers/index.server';
import { FORBIDDEN_ENROLMENTS, formatCampDateTime } from '@buxa/shared';
import {
  ClassesTable,
  ClassHoldsAndWaitlist,
  EnrolmentTable,
  instructorNames,
  PriceFact,
} from '@/components/components/classes';
import { EnrolForm, NewClassButton } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';

/**
 * The Classes tab of a session: its date range and classes, and a chosen class's details, holds, waitlist and
 * enrolments. A teacher sees only its own classes (the list is scoped on the server). Viewers see the schedule and names, with no
 * buttons to change anything.
 */
export async function ClassesTab({
  actor,
  session,
  classes,
  canManage,
  instructorChoices,
  selectedId,
}: {
  actor: Actor;
  session: Session;
  classes: Class[];
  canManage: boolean;
  instructorChoices: { id: string; name: string }[];
  /** The class chosen with `?class=`, already checked to be a UUID. */
  selectedId: string | null;
}) {
  // A teacher sees only its own classes, so each listed class is one it is assigned to.
  const canEditOwnClass = can(actor, 'events:update_details', { orgId: actor.orgId, assignedToClass: true });
  const { timeZone, clockFormat } = await campClock(actor);
  const selected = classes.find(c => c.id === selectedId) ?? null;
  const enrolments = selected ? await loadEnrolments(actor, selected.id) : null;
  // Holds and the waitlist are seat work: staff with holds:manage see them (a viewer does not).
  const holds = selected && can(actor, 'holds:manage') ? await loadActiveHolds(actor, selected.id) : null;
  const waitlist = enrolments?.ok && canManage ? enrolments.value.filter(e => e.status === 'waitlisted') : [];
  const campers = selected && canManage ? await loadPeopleWithRole(actor, 'camper') : null;
  const dates = session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet';
  const flaggedCount = classes.filter(c => c.datesOutsideSession).length;

  return (
    <>
      <dl className="people-facts classes-facts">
        <dt>Dates</dt>
        <dd>{dates}</dd>
        <dt>Classes</dt>
        <dd>{classes.length}</dd>
      </dl>

      <section aria-labelledby="classes-heading" className="stack">
        <h2 id="classes-heading" className="people-subheading">
          Classes
        </h2>
        {flaggedCount > 0 && (
          <Notice
            tone="warn"
            title={`${flaggedCount} ${flaggedCount === 1 ? 'class has' : 'classes have'} dates outside this session`}
            body="They take no places and are not on the public page until their dates are fixed. Edit each one marked Dates outside session, and give it dates inside the session."
          />
        )}
        {classes.length === 0 ? (
          <Empty
            icon="calendar"
            title="No classes yet"
            body={
              canManage
                ? 'Add the first class, with its time, ages, camp size and location.'
                : 'No classes are scheduled in this session yet.'
            }
            action={
              canManage && (
                <NewClassButton sessionId={session.id} sessionName={session.name} instructors={instructorChoices} />
              )
            }
          />
        ) : (
          <ClassesTable
            sessionId={session.id}
            sessionName={session.name}
            classes={classes}
            timeZone={timeZone}
            clockFormat={clockFormat}
            selectedId={selected?.id ?? null}
            canManage={canManage}
            canEdit={canManage || canEditOwnClass}
            instructors={instructorChoices}
          />
        )}
      </section>

      {selected && (
        <section id="enrolments" aria-labelledby="enrolments-heading" className="stack classes-enrolments">
          <h2 id="enrolments-heading" className="people-subheading">
            Enrolments
          </h2>
          <dl className="people-facts classes-facts" aria-label="Class details">
            <dt>Class</dt>
            <dd>{selected.name}</dd>
            <dt>Starts</dt>
            <dd>{formatCampDateTime(selected.startsAt, timeZone, clockFormat)}</dd>
            <dt>Ends</dt>
            <dd>{formatCampDateTime(selected.endsAt, timeZone, clockFormat)}</dd>
            <dt>Location</dt>
            <dd>{selected.location}</dd>
            <dt>Instructors</dt>
            <dd>{instructorNames(selected)}</dd>
            <PriceFact price={selected.price} timeZone={timeZone} />
          </dl>
          <p aria-live="polite" className="muted">
            {selected.seatsTaken} of {selected.capacity} places taken, {selected.waitlisted} on the waitlist.
          </p>
          {canManage && campers && (
            <EnrolForm
              classId={selected.id}
              campers={campers.ok ? campers.value.map(c => ({ id: c.id, name: c.name })) : []}
              full={seatFor(selected.capacity, selected.seatsTaken).kind === 'full'}
              canOverride={can(actor, 'attendance:override')}
            />
          )}
          {holds?.ok && (
            <ClassHoldsAndWaitlist
              sessionId={session.id}
              classId={selected.id}
              holds={holds.value.map(h => ({ id: h.id, householdName: h.householdName, expiresAt: h.expiresAt }))}
              waitlist={waitlist.map(w => ({ id: w.id, camperName: w.camperName, enrolledAt: w.enrolledAt }))}
              freePlaces={Math.max(0, selected.capacity - selected.seatsTaken)}
              timeZone={timeZone}
              clockFormat={clockFormat}
            />
          )}
          {!enrolments ? null : enrolments.ok ? (
            enrolments.value.length === 0 ? (
              <Empty icon="users" title="Nobody is enrolled yet" body="Enrolled and waitlisted campers appear here." />
            ) : (
              <EnrolmentTable
                classId={selected.id}
                enrolments={enrolments.value}
                canManage={canManage}
                timeZone={timeZone}
                clockFormat={clockFormat}
              />
            )
          ) : (
            <Empty icon="alert" title="You cannot see who is enrolled" body={FORBIDDEN_ENROLMENTS} />
          )}
        </section>
      )}
      {selected && (
        <p className="muted">
          <Button variant="ghost" href={sessionPath(session.id)}>
            Clear the class choice
          </Button>
        </p>
      )}
    </>
  );
}
