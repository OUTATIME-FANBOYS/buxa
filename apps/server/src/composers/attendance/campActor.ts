import 'server-only';
import type { ClockFormat, Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { findCampContext } from '../camp/campContext';
import { requireSession } from '../../session';

/** Who is asking, in the camp they are working in. Null when they have no camp selected (the caller answers not-found). */
export async function campActor(): Promise<Actor | null> {
  return (await findCampContext())?.actor ?? null;
}

/** The camp's IANA time zone. "Today" and every displayed time come from this, never from the server. */
export async function campZone(actor: Actor): Promise<string> {
  return (await getRuntime().services.orgs.getCamp(actor)).timezone;
}

/**
 * The camp's zone and the clock (12 or 24 hour) for a screen that shows times. The clock is always the signed-in person's own
 * choice; when they have not chosen (null) it is 24 hour. The camp's clock (`orgs.clock_format`) is ignored here.
 */
export async function campClock(actor: Actor): Promise<{ timeZone: string; clockFormat: ClockFormat }> {
  const [camp, session] = await Promise.all([getRuntime().services.orgs.getCamp(actor), requireSession()]);

  return { timeZone: camp.timezone, clockFormat: session.user.clockFormat ?? '24h' };
}
