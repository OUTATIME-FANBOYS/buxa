import type { ClockFormat } from '@buxa/domain';
import { Empty } from '@/components/components';
import { HoldsTable, type HoldRow } from './HoldsTable';
import { WaitlistTable, type WaitRow } from './WaitlistTable';

/**
 * The holds and the class waitlists, side by side. The caller passes only the rows to show (a camp page filters by session in the
 * URL; a session's own Holds tab is already one session). Read only: nothing here promotes a camper (that is on the class page).
 */
export function CampHoldsBoard({
  holds,
  waitlist,
  timeZone,
  clockFormat,
}: {
  holds: readonly HoldRow[];
  waitlist: readonly WaitRow[];
  timeZone: string;
  clockFormat: ClockFormat;
}) {
  return (
    <div className="stack holds-screen">
      <div className="holds-board">
        <section className="stack" aria-labelledby="holds-held-heading">
          <h2 id="holds-held-heading" className="people-subheading">
            Places held
          </h2>
          {holds.length === 0 ? (
            <Empty icon="clock" title="No one is holding a place right now." />
          ) : (
            <HoldsTable holds={holds} timeZone={timeZone} clockFormat={clockFormat} />
          )}
        </section>
        <section className="stack" aria-labelledby="holds-waitlist-heading">
          <h2 id="holds-waitlist-heading" className="people-subheading">
            Waitlists
          </h2>
          {waitlist.length === 0 ? (
            <Empty icon="list" title="Nobody is on a waitlist right now." />
          ) : (
            <WaitlistTable rows={waitlist} timeZone={timeZone} clockFormat={clockFormat} />
          )}
        </section>
      </div>
    </div>
  );
}
