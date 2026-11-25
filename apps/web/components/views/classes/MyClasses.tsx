import { notFound } from 'next/navigation';
import { Empty, PageHeader } from '@/components/components';
import { campClock, currentActor, loadMyClasses } from '@buxa/server/composers/index.server';
import { isTeachingView } from '@buxa/domain';
import { formatCampDateTime, formatCampTime } from '@buxa/shared';

/**
 * The teacher's own classes, grouped by session: each session's name and dates, then each class with its time range (in camp time),
 * ages and location. Read only. Not a teacher: not found. The list is scoped on the server, so only assigned classes arrive here.
 */
export async function MyClasses() {
  const actor = await currentActor();
  if (!actor || !isTeachingView(actor)) {
    notFound();
  }
  const loaded = await loadMyClasses(actor);
  if (!loaded.ok) {
    notFound();
  }
  const { timeZone, clockFormat } = await campClock(actor);
  const sessions = loaded.value;

  return (
    <div className="page">
      <PageHeader
        title="My classes"
        subtitle="The classes you are assigned to, grouped by session. Times are in camp time."
      />
      {sessions.length === 0 ? (
        <Empty icon="calendar" title="No classes yet" body="You are not assigned to any classes yet." />
      ) : (
        sessions.map(session => (
          <section key={session.id} className="my-classes-session" aria-labelledby={`session-${session.id}`}>
            <h2 id={`session-${session.id}`}>{session.name}</h2>
            <p className="muted">
              {session.startsOn && session.endsOn ? `${session.startsOn} to ${session.endsOn}` : 'Dates not set yet'}
            </p>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Your classes in {session.name}, in camp time</caption>
                <thead>
                  <tr>
                    <th scope="col">Class</th>
                    <th scope="col">Time</th>
                    <th scope="col">Ages</th>
                    <th scope="col">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {session.classes.map(cls => (
                    <tr key={cls.id}>
                      <td>{cls.name}</td>
                      <td>
                        {formatCampDateTime(cls.startsAt, timeZone, clockFormat)} to{' '}
                        {formatCampTime(cls.endsAt, timeZone, clockFormat)}
                      </td>
                      <td>
                        {cls.ageRange.minAge} to {cls.ageRange.maxAge}
                      </td>
                      <td>{cls.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
