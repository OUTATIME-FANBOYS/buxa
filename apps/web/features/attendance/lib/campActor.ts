import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { findCampContext } from '@/features/camp';

/** Who is asking, in the camp they are working in. Null when they have no camp selected (the caller answers not-found). */
export async function campActor(): Promise<Actor | null> {
  return (await findCampContext())?.actor ?? null;
}

/** The camp's IANA time zone. "Today" and every displayed time come from this, never from the server. */
export async function campZone(actor: Actor): Promise<string> {
  return (await getRuntime().services.orgs.getCamp(actor)).timezone;
}
