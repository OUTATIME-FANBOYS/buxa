'use server';
import { selectCampAction as selectCampActionImpl } from '@buxa/server/composers/camp/selectCampAction';
import { createCampAction as createCampActionImpl } from '@buxa/server/composers/camp/createCampAction';
import { renameCampAction as renameCampActionImpl } from '@buxa/server/composers/camp/renameCampAction';
import { updateCampClockAction as updateCampClockActionImpl } from '@buxa/server/composers/camp/updateCampClockAction';
import { archiveCamp as archiveCampImpl } from '@buxa/server/composers/camp/archiveCamp';
import { deleteCamp as deleteCampImpl } from '@buxa/server/composers/camp/deleteCamp';
import { listArchivedCamps as listArchivedCampsImpl } from '@buxa/server/composers/camp/listArchivedCamps';

// Server action wrappers for the camp screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function selectCampAction(...args: Parameters<typeof selectCampActionImpl>) {
  return selectCampActionImpl(...args);
}

export async function createCampAction(...args: Parameters<typeof createCampActionImpl>) {
  return createCampActionImpl(...args);
}

export async function renameCampAction(...args: Parameters<typeof renameCampActionImpl>) {
  return renameCampActionImpl(...args);
}

export async function updateCampClockAction(...args: Parameters<typeof updateCampClockActionImpl>) {
  return updateCampClockActionImpl(...args);
}

// Archive and delete. The server composers return the same CampResult shape as the other camp actions.

export type CampActionResult = { ok: true } | { ok: false; message: string };
export interface ArchivedCamp {
  id: string;
  name: string;
  archivedAt: string;
}

/** Archives the camp (owner only). It is hidden from the switcher, and its data is kept. */
export async function archiveCamp(input: { orgId: string }): Promise<CampActionResult> {
  return archiveCampImpl(input);
}

/** Deletes the camp and everything in it (owner only). `confirmName` must match the camp name exactly. */
export async function deleteCamp(input: { orgId: string; confirmName: string }): Promise<CampActionResult> {
  return deleteCampImpl(input);
}

/** The person's archived camps, read-only. */
export async function listArchivedCamps(): Promise<ArchivedCamp[]> {
  return listArchivedCampsImpl();
}
