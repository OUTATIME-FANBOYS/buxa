import type { Actor } from '@buxa/domain';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';
import { campClock, loadCampHolds, loadCampWaitlists } from '@buxa/server/composers/index.server';
import { Empty } from '@/components/components';
import { CampHoldsBoard } from '@/components/components/holds';
import { toWaitRow } from '@/components/views/holds';

/**
 * The Holds tab of a session: the places held in this session's classes, soonest to expire first, and the waitlist for them in join
 * order. It reads the same two lists as the camp-wide Holds screen, filtered to this session. Needs registration:read.
 */
export async function SessionHolds({ actor, sessionId }: { actor: Actor; sessionId: string }) {
  const holds = await loadCampHolds(actor);
  const waitlist = await loadCampWaitlists(actor);
  if (!holds.ok || !waitlist.ok) {
    return <Empty icon="alert" title="You cannot see holds" body={FORBIDDEN_REGISTRATION} />;
  }
  const { timeZone, clockFormat } = await campClock(actor);

  return (
    <CampHoldsBoard
      holds={holds.value.filter(hold => hold.sessionId === sessionId)}
      waitlist={waitlist.value.filter(row => row.sessionId === sessionId).map(toWaitRow)}
      timeZone={timeZone}
      clockFormat={clockFormat}
      showSessionFilter={false}
    />
  );
}
