'use server';

import type { ArchivedCamps } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';

/** The archived camps the signed-in person belongs to, read-only. */
export async function listArchivedCamps(): Promise<ArchivedCamps> {
  const session = await requireSession();
  const camps = await getRuntime().services.orgs.listArchivedCamps(session.user.id);

  return camps.map(c => ({ id: c.id, name: c.name, archivedAt: c.archivedAt }));
}
