import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, isUuid } from '@buxa/domain';
import { ROUTES, classPath, newSessionPath } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { campClock } from '@buxa/server/composers/index.server';
import { currentActor } from '@buxa/server/composers/index.server';
import { FORBIDDEN_ENROLMENTS, FORBIDDEN_READ } from '@buxa/shared';
import { loadClassPage, loadEnrolments, loadPeopleWithRole } from '@buxa/server/composers/index.server';
import { EnrolmentTable } from '@/components/components/classes';
import { SessionTable, instructorNames } from '@/components/components/classes';
import { formatCampDateTime } from '@buxa/shared';
import { EnrolForm } from '@/components/components/classes/forms';
import { Button } from '@/components/elements';

const pick = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && isUuid(value) ? value : null;

/**
 * One class: its ages, default places and instructor ratio, its sessions with capacity and enrolled counts, and (when a session is
 * chosen) who is enrolled there. A full session offers the waitlist instead of a place. Viewers see the schedule and the names
 * enrolled, with no buttons to change anything.
 */
export async function ClassPage({
  classId,
  searchParams,
}: {
  classId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadClassPage(actor, classId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return (
      <div className="page">
        <Empty icon="alert" title="You cannot see this class" body={FORBIDDEN_READ} />
      </div>
    );
  }

  const { cls, sessions } = loaded.value;
  const canManage = can(actor, 'classes:manage');
  const { timeZone, clockFormat } = await campClock(actor);
  const selectedId = pick(searchParams.session);
  const selected = sessions.find(s => s.id === selectedId) ?? null;

  const enrolments = selected ? await loadEnrolments(actor, selected.id) : null;
  const campers = selected && canManage ? await loadPeopleWithRole(actor, 'camper') : null;
  const ratio = cls.instructorRatio ? `${cls.instructorRatio.instructors}:${cls.instructorRatio.campers}` : 'Not set';

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="muted">
        <Link className="link" href={ROUTES.classes}>
          Classes
        </Link>{' '}
        / {cls.name}
      </nav>
      <PageHeader
        title={cls.name}
        subtitle={cls.description || 'No description yet.'}
        actions={
          canManage && (
            <Button variant="primary" className="classes-target" icon="plus" href={newSessionPath(cls.id)}>
              Add session
            </Button>
          )
        }
      />

      <dl className="people-facts classes-facts">
        <dt>Ages</dt>
        <dd>
          {cls.ageRange.minAge} to {cls.ageRange.maxAge}
        </dd>
        <dt>Default places</dt>
        <dd>{cls.capacity}</dd>
        <dt>Instructor ratio</dt>
        <dd>{ratio}</dd>
      </dl>

      <section aria-labelledby="sessions-heading" className="stack">
        <h2 id="sessions-heading" className="people-subheading">
          Sessions
        </h2>
        {sessions.length === 0 ? (
          <Empty
            icon="calendar"
            title="No sessions yet"
            body={
              canManage
                ? 'Add the first session, with its time, place and instructors.'
                : 'No sessions are scheduled for this class yet.'
            }
            action={
              canManage && (
                <Button variant="primary" className="classes-target" icon="plus" href={newSessionPath(cls.id)}>
                  Add session
                </Button>
              )
            }
          />
        ) : (
          <SessionTable
            classId={cls.id}
            sessions={sessions}
            timeZone={timeZone}
            clockFormat={clockFormat}
            selectedId={selected?.id ?? null}
          />
        )}
      </section>

      {selected && (
        <section id="enrolments" aria-labelledby="enrolments-heading" className="stack classes-enrolments">
          <h2 id="enrolments-heading" className="people-subheading">
            Enrolments
          </h2>
          <dl className="people-facts classes-facts" aria-label="Session details">
            <dt>Starts</dt>
            <dd>{formatCampDateTime(selected.startsAt, timeZone, clockFormat)}</dd>
            <dt>Ends</dt>
            <dd>{formatCampDateTime(selected.endsAt, timeZone, clockFormat)}</dd>
            <dt>Location</dt>
            <dd>{selected.location}</dd>
            <dt>Instructors</dt>
            <dd>{instructorNames(selected)}</dd>
          </dl>
          <p aria-live="polite" className="muted">
            {selected.seatsTaken} of {selected.capacity} places taken, {selected.waitlisted} on the waitlist.
          </p>
          {canManage && campers && (
            <EnrolForm
              classId={cls.id}
              sessionId={selected.id}
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
                classId={cls.id}
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
      <p className="muted">
        <Link className="link" href={classPath(cls.id)}>
          Clear the session choice
        </Link>
      </p>
    </div>
  );
}
