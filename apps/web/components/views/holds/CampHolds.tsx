import { notFound } from 'next/navigation';
import { Empty, PageHeader } from '@/components/components';
import { CampHoldsBoard, type WaitRow } from '@/components/components/holds';
import type { CampWaitlistEntry } from '@buxa/server/classes/ClassRepository';
import { campClock, currentActor, loadCampHolds, loadCampWaitlists } from '@buxa/server/composers/index.server';
import { FORBIDDEN_REGISTRATION } from '@buxa/shared';

/**
 * The holds across the camp: every place a family holds now, soonest to expire first, with each class's waitlist beside it. Anyone
 * who can read registration sees it; anyone else gets a short refusal, not the data. Times are in camp time.
 */
export async function CampHolds() {
  const actor = await currentActor();
  if (!actor) {
    notFound();
  }
  const holds = await loadCampHolds(actor);
  const waitlist = await loadCampWaitlists(actor);
  const { timeZone, clockFormat } = await campClock(actor);

  return (
    <div className="page">
      <PageHeader
        title="Holds"
        subtitle="Places families hold while they finish registering, and the waitlist for each class. Promote a camper from the class page."
      />
      {!holds.ok || !waitlist.ok ? (
        <Empty icon="alert" title="You cannot see holds" body={FORBIDDEN_REGISTRATION} />
      ) : (
        <CampHoldsBoard
          holds={holds.value}
          waitlist={waitlist.value.map(toWaitRow)}
          timeZone={timeZone}
          clockFormat={clockFormat}
        />
      )}
    </div>
  );
}

/** The waitlist row the board shows: the enrolment's id is the row key. */
const toWaitRow = (row: CampWaitlistEntry): WaitRow => ({
  id: row.enrolmentId,
  sessionId: row.sessionId,
  sessionName: row.sessionName,
  classId: row.classId,
  className: row.className,
  householdName: row.householdName,
  camperName: row.camperName,
  joinedAt: row.joinedAt,
});
