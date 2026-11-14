import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { getCurrentCamp, requireSession, toActor } from '@/server/session';

/** Who is asking, in the camp they are working in. Null when they have no camp selected (the caller answers not-found). */
export async function campActor(): Promise<Actor | null> {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  return camp ? toActor(session, camp) : null;
}

/** The camp's IANA time zone. "Today" and every displayed time come from this, never from the server. */
export async function campZone(actor: Actor): Promise<string> {
  return (await getRuntime().services.orgs.getCamp(actor)).timezone;
}
