import { notFound } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import { getCurrentCamp, requireSession, toActor } from '@/server/session';
import type { Session } from '@/server/auth/session';
import type { Actor } from '@buxa/domain';

export interface CampContext { session: Session; camp: Membership; actor: Actor }

/**
 * Who is asking, and which camp they are working in. Null when no camp is selected, for callers that answer in their own way
 * (an action refuses, a page answers not-found).
 */
export async function findCampContext(): Promise<CampContext | null> {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  return camp ? { session, camp, actor: toActor(session, camp) } : null;
}

/**
 * Who is looking at which camp, for a page inside the camp area. The camp layout shows first-run setup instead of the page when
 * there is no camp, so reaching a page without one is a stray request: answer "not found".
 */
export async function campContext(): Promise<CampContext> {
  const context = await findCampContext();
  if (!context) notFound();
  return context;
}
