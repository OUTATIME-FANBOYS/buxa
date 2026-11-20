'use server';
import { selectCampAction as selectCampActionImpl } from '@buxa/server/composers/camp/selectCampAction';
import { createCampAction as createCampActionImpl } from '@buxa/server/composers/camp/createCampAction';
import { renameCampAction as renameCampActionImpl } from '@buxa/server/composers/camp/renameCampAction';
import { archiveCamp as archiveCampImpl } from '@buxa/server/composers/camp/archiveCamp';
import { deleteCamp as deleteCampImpl } from '@buxa/server/composers/camp/deleteCamp';
import { unarchiveCamp as unarchiveCampImpl } from '@buxa/server/composers/camp/unarchiveCamp';
import { listArchivedCamps as listArchivedCampsImpl } from '@buxa/server/composers/camp/listArchivedCamps';
import { rotateCalendarTokenAction as rotateCalendarTokenActionImpl } from '@buxa/server/composers/camp/rotateCalendarTokenAction';

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

// Archive and delete. The server composers return the same CampResult shape as the other camp actions.

export type CampActionResult = { ok: true } | { ok: false; message: string };
export interface ArchivedCamp {
  id: string;
  name: string;
  archivedAt: string;
  /** The person's role in the camp. Only the owner may unarchive or delete it. */
  role: 'viewer' | 'staff' | 'admin' | 'owner' | 'teacher';
}

/** Archives the camp (owner only). It is hidden from the switcher, and its data is kept. */
export async function archiveCamp(input: { orgId: string }): Promise<CampActionResult> {
  return archiveCampImpl(input);
}

/** Makes an archived camp active again (owner only). Its data is unchanged. */
export async function unarchiveCamp(input: { orgId: string }): Promise<CampActionResult> {
  return unarchiveCampImpl(input);
}

/** Deletes the camp and everything in it (owner only). `confirmName` must match the camp name exactly. */
export async function deleteCamp(input: { orgId: string; confirmName: string }): Promise<CampActionResult> {
  return deleteCampImpl(input);
}

/** The person's archived camps. Read-only, except that the owner may unarchive or delete one. */
export async function listArchivedCamps(): Promise<ArchivedCamp[]> {
  return listArchivedCampsImpl();
}

export async function rotateCalendarTokenAction() {
  return rotateCalendarTokenActionImpl();
}
