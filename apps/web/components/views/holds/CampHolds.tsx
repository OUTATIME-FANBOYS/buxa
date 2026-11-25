import { notFound } from 'next/navigation';
import {
  ALL_SESSIONS,
  chosenSession,
  defaultSessionChoice,
  FORBIDDEN_REGISTRATION,
  inChosenSession,
  knownSessions,
  SESSION_PARAM,
} from '@buxa/shared';
import { ROUTES } from '@/config/routes';
import { Empty, PageHeader } from '@/components/components';
import { CampHoldsBoard, type WaitRow } from '@/components/components/holds';
import { SessionFilter } from '@/components/components/filters';
import type { CampWaitlistEntry } from '@buxa/server/classes/ClassRepository';
import {
  campClock,
  currentActor,
  loadCampHolds,
  loadCampWaitlists,
  loadSessions,
} from '@buxa/server/composers/index.server';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The holds across the camp: every place a family holds now, soonest to expire first, with each class's waitlist beside it. Anyone
 * who can read registration sees it; anyone else gets a short refusal, not the data. Times are in camp time. The session filter
 * (`?session=`) narrows both lists; with no choice in the URL it opens on the one live session, or All sessions.
 */
export async function CampHolds({ searchParams = {} }: { searchParams?: SearchParams } = {}) {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const holds = await loadCampHolds(actor);
  const waitlist = await loadCampWaitlists(actor);
  const sessions = await loadSessions(actor);
  const { timeZone, clockFormat } = await campClock(actor);

  if (!holds.ok || !waitlist.ok) {
    return (
      <div className="page">
        <PageHeader title="Holds" />
        <Empty icon="alert" title="You cannot see holds" body={FORBIDDEN_REGISTRATION} />
      </div>
    );
  }
  const choices = knownSessions(sessions.ok ? sessions.value : [], [...holds.value, ...waitlist.value]);
  const chosen = chosenSession(
    searchParams[SESSION_PARAM],
    choices,
    sessions.ok ? defaultSessionChoice(sessions.value) : ALL_SESSIONS,
  );

  return (
    <div className="page">
      <div className="holds-head">
        <PageHeader
          title="Holds"
          subtitle="Places families hold while they finish registering, and the waitlist for each class. Promote a camper from the class page."
          actions={
            choices.length > 0 ? <SessionFilter action={ROUTES.holds} sessions={choices} value={chosen} /> : undefined
          }
        />
      </div>
      <CampHoldsBoard
        holds={holds.value.filter(hold => inChosenSession(hold.sessionId, chosen))}
        waitlist={waitlist.value.filter(row => inChosenSession(row.sessionId, chosen)).map(toWaitRow)}
        timeZone={timeZone}
        clockFormat={clockFormat}
      />
    </div>
  );
}

/** The waitlist row the board shows: the enrolment's id is the row key. */
export const toWaitRow = (row: CampWaitlistEntry): WaitRow => ({
  id: row.enrolmentId,
  sessionId: row.sessionId,
  sessionName: row.sessionName,
  classId: row.classId,
  className: row.className,
  householdName: row.householdName,
  camperName: row.camperName,
  joinedAt: row.joinedAt,
});
