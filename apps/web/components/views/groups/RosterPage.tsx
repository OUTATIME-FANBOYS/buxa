import { notFound } from 'next/navigation';
import { groupsPath } from '@/config/routes';
import { Button, PrintButton } from '@/components/elements';
import { RosterSheet } from '@/components/components/groups';
import { currentActor, loadRoster } from '@buxa/server/composers/index.server';

/** The session's date span, as the Groups page words it. */
function datesOf(startsOn: string | null | undefined, endsOn: string | null | undefined): string {
  return startsOn && endsOn ? `${startsOn} to ${endsOn}` : 'Dates not set yet';
}

/**
 * The printable roster for one session. It sits outside the camp shell, so it has no sidebar or topbar: the only controls are a link
 * back and Print, and both are hidden in print. Permission is the roster read's: a teacher, who cannot read the placements, sees the
 * same "cannot see" notice as on the Groups page.
 */
export async function RosterPage({ sessionId }: { sessionId: string }) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const loaded = await loadRoster(actor, sessionId);
  if (!loaded.ok) {
    if (loaded.reason === 'not-found') {
      notFound();
    }

    return <p>You cannot see this session.</p>;
  }

  const { session, roster } = loaded.value;

  return (
    <main className="roster-print">
      <nav aria-label="Roster actions" className="roster-back no-print">
        <Button variant="ghost" size="sm" className="roster-back-link" href={groupsPath(session.id)}>
          Back to groups and rooms
        </Button>
      </nav>
      <RosterSheet
        sessionName={session.name}
        dates={datesOf(session.startsOn, session.endsOn)}
        roster={roster}
        actions={<PrintButton label="Print roster" className="no-print" />}
      />
    </main>
  );
}
