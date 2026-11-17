import 'server-only';
import type { ClockFormat, Actor } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { findCampContext } from '../camp/campContext';

/** Who is asking, in the camp they are working in. Null when they have no camp selected (the caller answers not-found). */
export async function campActor(): Promise<Actor | null> {
  return (await findCampContext())?.actor ?? null;
}

/** The camp's IANA time zone. "Today" and every displayed time come from this, never from the server. */
export async function campZone(actor: Actor): Promise<string> {
  return (await getRuntime().services.orgs.getCamp(actor)).timezone;
}

/** The camp's zone and its clock (12 or 24 hour), for a screen that shows times. One read of the camp record. */
export async function campClock(actor: Actor): Promise<{ timeZone: string; clockFormat: ClockFormat }> {
  const camp = await getRuntime().services.orgs.getCamp(actor);

  return { timeZone: camp.timezone, clockFormat: camp.clockFormat };
}
