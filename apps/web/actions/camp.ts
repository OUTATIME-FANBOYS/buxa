'use server';
import { selectCampAction as selectCampActionImpl } from '@buxa/server/composers/camp/selectCampAction';
import { createCampAction as createCampActionImpl } from '@buxa/server/composers/camp/createCampAction';
import { renameCampAction as renameCampActionImpl } from '@buxa/server/composers/camp/renameCampAction';
import { updateCampClockAction as updateCampClockActionImpl } from '@buxa/server/composers/camp/updateCampClockAction';
import { settle } from '@buxa/domain';

// Server action wrappers for the camp screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export function selectCampAction(...args: Parameters<typeof selectCampActionImpl>) {
  return settle(() => {
    return selectCampActionImpl(...args);
  });
}

export function createCampAction(...args: Parameters<typeof createCampActionImpl>) {
  return settle(() => {
    return createCampActionImpl(...args);
  });
}

export function renameCampAction(...args: Parameters<typeof renameCampActionImpl>) {
  return settle(() => {
    return renameCampActionImpl(...args);
  });
}

export function updateCampClockAction(...args: Parameters<typeof updateCampClockActionImpl>) {
  return settle(() => {
    return updateCampClockActionImpl(...args);
  });
}
