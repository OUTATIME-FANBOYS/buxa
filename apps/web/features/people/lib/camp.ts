import 'server-only';
import type { Actor } from '@buxa/domain';
import { getCurrentCamp, requireSession, toActor } from '@/server/session';

/** The actor for the camp the person is working in, or null when they have no camp (the page answers not-found). */
export async function currentActor(): Promise<Actor | null> {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  return camp ? toActor(session, camp) : null;
}
