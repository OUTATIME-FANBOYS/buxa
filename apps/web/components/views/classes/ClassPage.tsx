import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, isUuid } from '@buxa/domain';
import { ROUTES, sessionPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { campClock } from '@buxa/server/composers/index.server';
import { currentActor } from '@buxa/server/composers/index.server';
import { FORBIDDEN_ENROLMENTS, FORBIDDEN_READ } from '@buxa/shared';
import { loadSessionPage, loadEnrolments, loadPeopleWithRole } from '@buxa/server/composers/index.server';
import { ClassesTable, EnrolmentTable, instructorNames, PriceFact } from '@/components/components/classes';
import { EnrolForm, NewClassButton, SessionPriceButton } from '@/components/components/classes/forms';
import { formatCampDateTime } from '@buxa/shared';
import { Button } from '@/components/elements';

const pick = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && isUuid(value) ? value : null;

/**
 * One session: its date range and its classes, each with its ages, camp size, times, location, instructors and seat counts. A
 * chosen class shows who is enrolled there. A full class offers the waitlist instead of a place. Viewers see the schedule and the
 * names enrolled, with no buttons to change anything.
 */
export async function ClassPage({
  classId: sessionId,
  searchParams,
}: {
  /** The session's id: the route segment keeps its historical name. */
  classId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadSessionPage(actor, sessionId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot see this session" body={FORBIDDEN_READ} />
      </div>
    );
  }

  const { session, classes } = loaded.value;
  const canManage = can(actor, 'classes:manage');
  const { timeZone, clockFormat } = await campClock(actor);
  const selectedId = pick(searchParams.class);
  const selected = classes.find(c => c.id === selectedId) ?? null;
  const instructors = canManage ? await loadPeopleWithRole(actor, 'instructor') : null;
  const instructorChoices = instructors?.ok ? instructors.value.map(i => ({ id: i.id, name: i.name })) : [];

  const enrolments = selected ? await loadEnrolments(actor, selected.id) : null;
  const campers = selected && canManage ? await loadPeopleWithRole(actor, 'camper') : null;
  const dates = session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet';

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={ROUTES.sessions}>
          Sessions
        </Link>{' '}
        / {session.name}
      </nav>
      <PageHeader
        title={session.name}
        subtitle={session.description || 'No description yet.'}
        actions={
          canManage && (
            <NewClassButton
              sessionId={session.id}
              sessionName={session.name}
              timeZone={timeZone}
              instructors={instructorChoices}
            />
          )
        }
      />

      <dl className="people-facts classes-facts">
        <dt>Dates</dt>
        <dd>{dates}</dd>
        <dt>Classes</dt>
        <dd>{classes.length}</dd>
        <PriceFact
          price={session.price}
          timeZone={timeZone}
          action={canManage && <SessionPriceButton sessionId={session.id} price={session.price} />}
        />
      </dl>

      <section aria-labelledby="classes-heading" className="stack">
        <h2 id="classes-heading" className="people-subheading">
          Classes
        </h2>
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
                <NewClassButton
                  sessionId={session.id}
                  sessionName={session.name}
                  timeZone={timeZone}
                  instructors={instructorChoices}
                />
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
              full={selected.seatsTaken >= selected.capacity}
              canOverride={can(actor, 'attendance:override')}
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
    </div>
  );
}
