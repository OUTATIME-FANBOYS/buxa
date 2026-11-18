'use server';
import { selectCampAction as selectCampActionImpl } from '@buxa/server/composers/camp/selectCampAction';
import { createCampAction as createCampActionImpl } from '@buxa/server/composers/camp/createCampAction';
import { renameCampAction as renameCampActionImpl } from '@buxa/server/composers/camp/renameCampAction';
import { updateCampClockAction as updateCampClockActionImpl } from '@buxa/server/composers/camp/updateCampClockAction';

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

// Archive and delete. The contract is fixed; the server side (issue #266, branch v0.2/feat/camp-archive-server) replaces these stubs.
// STUB until server issue #266 merges: nothing is archived or deleted, and no camp is listed as archived. Replace the bodies with the server composers.

export type CampActionResult = { ok: true } | { ok: false; message: string };
export interface ArchivedCamp {
  id: string;
  name: string;
  archivedAt: string;
}

/** STUB (server issue #266): archives the camp. It is hidden from the switcher, and its data is kept. */
export async function archiveCamp(_input: { orgId: string }): Promise<CampActionResult> {
  void _input;

  return { ok: false, message: 'Archiving is not available yet.' };
}

/** STUB (server issue #266): deletes the camp and everything in it. `confirmName` must match the camp name exactly. */
export async function deleteCamp(_input: { orgId: string; confirmName: string }): Promise<CampActionResult> {
  void _input;

  return { ok: false, message: 'Deleting is not available yet.' };
}

/** STUB (server issue #266): the person's archived camps. */
export async function listArchivedCamps(): Promise<ArchivedCamp[]> {
  return [];
}
