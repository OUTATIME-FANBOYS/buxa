import { notFound } from 'next/navigation';
import { getRuntime } from '@buxa/server/runtime';
import { formatWhen } from '@buxa/server/publicSessions/PublicSessionService';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Session' };

/**
 * A public session page: read by anyone, no sign-in. It lists the session's upcoming classes, each with when, where and the ages,
 * and nothing else: no instructors, no enrolled campers, no seats, no contact details. A session that is not public, or a camp
 * that is archived, is a plain 404.
 */
export default async function PublicSessionPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const page = await getRuntime().services.publicSessions.getPage(slug, sessionId, new Date());
  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-sm text-neutral-500">{page.campName}</p>
      <h1 className="mt-1 text-2xl font-semibold">{page.sessionName}</h1>
      {page.description !== '' && <p className="mt-4 whitespace-pre-line">{page.description}</p>}

      <h2 className="mt-8 text-lg font-semibold">Upcoming classes</h2>
      {page.classes.length === 0 ? (
        <p className="mt-2 text-neutral-600">No upcoming classes are scheduled.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200">
          {page.classes.map(cls => (
            <li key={`${cls.startsAt}-${cls.name}`} className="py-3">
              <p className="font-medium">{cls.name}</p>
              <p className="text-sm text-neutral-600">
                {formatWhen(cls.startsAt, cls.endsAt, page.timeZone)} · {cls.location}
              </p>
              <p className="text-sm text-neutral-600">
                Ages {cls.ageRange.minAge} to {cls.ageRange.maxAge}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-neutral-500">Times are in the camp&apos;s time zone.</p>
    </main>
  );
}
