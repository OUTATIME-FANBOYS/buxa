import type { Series, Session } from '@buxa/contracts';
import { can, seatFor, type Actor } from '@buxa/domain';
import { sessionPath } from '@/config/routes';
import { Empty, Notice } from '@/components/components';
import {
  campClock,
  loadActiveHolds,
  loadEnrolments,
  loadPeopleWithRole,
  loadSeriesDays,
} from '@buxa/server/composers/index.server';
import { FORBIDDEN_ENROLMENTS, FORBIDDEN_READ, seriesDaysLabel } from '@buxa/shared';
import {
  ClassesTable,
  ClassHoldsAndWaitlist,
  EnrolmentTable,
  instructorNames,
  PriceFact,
  SeriesDaysPanel,
} from '@/components/components/classes';
import { EnrolForm, NewClassButton } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';

/**
 * The Classes tab of a session: its date range and its class series, one row each, and a chosen series' details, days, holds,
 * waitlist and enrolments. Enrolments, holds and places are kept per series, so the chosen series is reached through its anchor
 * day (`?class=`). A teacher sees only its own series (the list is scoped on the server). Viewers see the schedule and names, with
 * no buttons to change anything.
 */
export async function ClassesTab({
  actor,
  session,
  series,
  canManage,
  instructorChoices,
  selectedId,
  daysId,
}: {
  actor: Actor;
  session: Session;
  series: Series[];
  canManage: boolean;
  instructorChoices: { id: string; name: string }[];
  /** The series' anchor day chosen with `?class=`, already checked to be a UUID. */
  selectedId: string | null;
  /** The series whose days are open, chosen with `?days=`, already checked to be a UUID. */
  daysId: string | null;
}) {
  // A teacher sees only its own series, so each listed series is one it teaches.
  const canEditOwnClass = can(actor, 'events:update_details', { orgId: actor.orgId, assignedToClass: true });
  const { timeZone, clockFormat } = await campClock(actor);
  const selected = series.find(s => s.anchorClassId === selectedId) ?? null;
  const daysSeries = series.find(s => s.id === daysId) ?? null;
  const enrolments = selected ? await loadEnrolments(actor, selected.anchorClassId) : null;
  // Holds and the waitlist are seat work: staff with holds:manage see them (a viewer does not).
  const holds = selected && can(actor, 'holds:manage') ? await loadActiveHolds(actor, selected.anchorClassId) : null;
  const waitlist = enrolments?.ok && canManage ? enrolments.value.filter(e => e.status === 'waitlisted') : [];
  const campers = selected && canManage ? await loadPeopleWithRole(actor, 'camper') : null;
  const days = daysSeries ? await loadSeriesDays(actor, daysSeries.id) : null;
  const dates = session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet';
  const flaggedCount = series.filter(s => s.occurrenceCount > 0 && s.activeOccurrenceCount === 0).length;

  return (
    <>
      <dl className="people-facts classes-facts">
        <dt>Dates</dt>
        <dd>{dates}</dd>
        <dt>Classes</dt>
        <dd>{series.length}</dd>
      </dl>

      <section aria-labelledby="classes-heading" className="stack">
        <h2 id="classes-heading" className="people-subheading">
          Classes
        </h2>
        {flaggedCount > 0 && (
          <Notice
            tone="warn"
            title={`${flaggedCount} ${flaggedCount === 1 ? 'class has' : 'classes have'} every day cancelled`}
            body="They take no places on the calendar or the public page until a day is restored."
          />
        )}
        {series.length === 0 ? (
          <Empty
            icon="calendar"
            title="No classes yet"
            body={
              canManage
                ? 'Add the first class: pick its days, with its times, ages, camp size and location.'
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
            series={series}
            timeZone={timeZone}
            selectedId={selected?.anchorClassId ?? null}
            daysId={daysSeries?.id ?? null}
            canManage={canManage}
            canEdit={canManage || canEditOwnClass}
            instructors={instructorChoices}
          />
        )}
      </section>

      {daysSeries &&
        (days?.ok ? (
          <SeriesDaysPanel
            sessionId={session.id}
            seriesName={daysSeries.name}
            days={days.value}
            timeZone={timeZone}
            clockFormat={clockFormat}
            canManage={canManage}
          />
        ) : (
          <Empty icon="alert" title="You cannot see these days" body={FORBIDDEN_READ} />
        ))}

      {selected && (
        <section id="enrolments" aria-labelledby="enrolments-heading" className="stack classes-enrolments">
          <h2 id="enrolments-heading" className="people-subheading">
            Enrolments
          </h2>
          <dl className="people-facts classes-facts" aria-label="Class details">
            <dt>Class</dt>
            <dd>{selected.name}</dd>
            <dt>Days</dt>
            <dd>{seriesDaysLabel(selected.weekdays)}</dd>
            <dt>Times</dt>
            <dd>
              {selected.startTime} to {selected.endTime}
            </dd>
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
              classId={selected.anchorClassId}
              campers={campers.ok ? campers.value.map(c => ({ id: c.id, name: c.name })) : []}
              full={seatFor(selected.capacity, selected.seatsTaken).kind === 'full'}
              canOverride={can(actor, 'attendance:override')}
            />
          )}
          {holds?.ok && (
            <ClassHoldsAndWaitlist
              sessionId={session.id}
              classId={selected.anchorClassId}
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
                classId={selected.anchorClassId}
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
      {(selected || daysSeries) && (
        <p className="muted">
          <Button variant="ghost" href={sessionPath(session.id)}>
            Clear the class choice
          </Button>
        </p>
      )}
    </>
  );
}
