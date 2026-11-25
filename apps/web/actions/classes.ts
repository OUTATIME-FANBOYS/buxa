'use server';
import { cancelEnrolmentAction as cancelEnrolmentActionImpl } from '@buxa/server/composers/classes/cancelEnrolmentAction';
import { enrolAction as enrolActionImpl } from '@buxa/server/composers/classes/enrolAction';
import { promoteWaitlistAction as promoteWaitlistActionImpl } from '@buxa/server/composers/classes/promoteWaitlistAction';
import { importClassesAction as importClassesActionImpl } from '@buxa/server/composers/classes/importClassesAction';
import { createSessionAction as createSessionActionImpl } from '@buxa/server/composers/classes/createSessionAction';
import { addClassAction as addClassActionImpl } from '@buxa/server/composers/classes/addClassAction';
import { updateClassAction as updateClassActionImpl } from '@buxa/server/composers/classes/updateClassAction';
import { deleteClassAction as deleteClassActionImpl } from '@buxa/server/composers/classes/deleteClassAction';
import { addSeriesAction as addSeriesActionImpl } from '@buxa/server/composers/classes/addSeriesAction';
import {
  cancelOccurrenceAction as cancelOccurrenceActionImpl,
  deleteSeriesAction as deleteSeriesActionImpl,
  restoreOccurrenceAction as restoreOccurrenceActionImpl,
  updateSeriesAction as updateSeriesActionImpl,
} from '@buxa/server/composers/classes/seriesActions';
import { updateSessionAction as updateSessionActionImpl } from '@buxa/server/composers/classes/updateSessionAction';
import { previewSessionDatesAction as previewSessionDatesActionImpl } from '@buxa/server/composers/classes/previewSessionDatesAction';
import { deleteSessionAction as deleteSessionActionImpl } from '@buxa/server/composers/classes/deleteSessionAction';
import { deleteSessionsAction as deleteSessionsActionImpl } from '@buxa/server/composers/classes/deleteSessionsAction';
import { deleteSessionWithClassesAction as deleteSessionWithClassesActionImpl } from '@buxa/server/composers/classes/deleteSessionWithClassesAction';
import { setSessionArchivedAction as setSessionArchivedActionImpl } from '@buxa/server/composers/classes/setSessionArchivedAction';
import { publishSessionAction as publishSessionActionImpl } from '@buxa/server/composers/classes/publishSessionAction';
import { sessionDeleteImpactAction as sessionDeleteImpactActionImpl } from '@buxa/server/composers/classes/sessionDeleteImpactAction';

// Server action wrappers for the classes screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function cancelEnrolmentAction(...args: Parameters<typeof cancelEnrolmentActionImpl>) {
  return cancelEnrolmentActionImpl(...args);
}

export async function enrolAction(...args: Parameters<typeof enrolActionImpl>) {
  return enrolActionImpl(...args);
}

export async function importClassesAction(...args: Parameters<typeof importClassesActionImpl>) {
  return importClassesActionImpl(...args);
}

export async function createSessionAction(...args: Parameters<typeof createSessionActionImpl>) {
  return createSessionActionImpl(...args);
}

export async function addClassAction(...args: Parameters<typeof addClassActionImpl>) {
  return addClassActionImpl(...args);
}

export async function updateClassAction(...args: Parameters<typeof updateClassActionImpl>) {
  return updateClassActionImpl(...args);
}

export async function deleteClassAction(...args: Parameters<typeof deleteClassActionImpl>) {
  return deleteClassActionImpl(...args);
}

export async function addSeriesAction(...args: Parameters<typeof addSeriesActionImpl>) {
  return addSeriesActionImpl(...args);
}

export async function updateSessionAction(...args: Parameters<typeof updateSessionActionImpl>) {
  return updateSessionActionImpl(...args);
}

export async function previewSessionDatesAction(...args: Parameters<typeof previewSessionDatesActionImpl>) {
  return previewSessionDatesActionImpl(...args);
}

export async function deleteSessionAction(...args: Parameters<typeof deleteSessionActionImpl>) {
  return deleteSessionActionImpl(...args);
}

export async function deleteSessionsAction(...args: Parameters<typeof deleteSessionsActionImpl>) {
  return deleteSessionsActionImpl(...args);
}

export async function deleteSessionWithClassesAction(...args: Parameters<typeof deleteSessionWithClassesActionImpl>) {
  return deleteSessionWithClassesActionImpl(...args);
}

export async function setSessionArchivedAction(...args: Parameters<typeof setSessionArchivedActionImpl>) {
  return setSessionArchivedActionImpl(...args);
}

export async function publishSessionAction(...args: Parameters<typeof publishSessionActionImpl>) {
  return publishSessionActionImpl(...args);
}

export async function sessionDeleteImpactAction(...args: Parameters<typeof sessionDeleteImpactActionImpl>) {
  return sessionDeleteImpactActionImpl(...args);
}

export async function promoteWaitlistAction(...args: Parameters<typeof promoteWaitlistActionImpl>) {
  return promoteWaitlistActionImpl(...args);
}

export async function updateSeriesAction(...args: Parameters<typeof updateSeriesActionImpl>) {
  return updateSeriesActionImpl(...args);
}

export async function deleteSeriesAction(...args: Parameters<typeof deleteSeriesActionImpl>) {
  return deleteSeriesActionImpl(...args);
}

export async function cancelOccurrenceAction(...args: Parameters<typeof cancelOccurrenceActionImpl>) {
  return cancelOccurrenceActionImpl(...args);
}

export async function restoreOccurrenceAction(...args: Parameters<typeof restoreOccurrenceActionImpl>) {
  return restoreOccurrenceActionImpl(...args);
}
