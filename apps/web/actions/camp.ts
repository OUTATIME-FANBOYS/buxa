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
