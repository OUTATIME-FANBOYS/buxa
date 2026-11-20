'use server';
import { cancelEnrolmentAction as cancelEnrolmentActionImpl } from '@buxa/server/composers/classes/cancelEnrolmentAction';
import { enrolAction as enrolActionImpl } from '@buxa/server/composers/classes/enrolAction';
import { importClassesAction as importClassesActionImpl } from '@buxa/server/composers/classes/importClassesAction';
import { createSessionAction as createSessionActionImpl } from '@buxa/server/composers/classes/createSessionAction';
import { addClassAction as addClassActionImpl } from '@buxa/server/composers/classes/addClassAction';
import { updateClassAction as updateClassActionImpl } from '@buxa/server/composers/classes/updateClassAction';
import { deleteClassAction as deleteClassActionImpl } from '@buxa/server/composers/classes/deleteClassAction';
import { setSessionPriceAction as setSessionPriceActionImpl } from '@buxa/server/composers/classes/setSessionPriceAction';
import { setSessionPublicAction as setSessionPublicActionImpl } from '@buxa/server/composers/classes/setSessionPublicAction';
import { addRecurringClassesAction as addRecurringClassesActionImpl } from '@buxa/server/composers/classes/addRecurringClassesAction';

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

export async function setSessionPriceAction(...args: Parameters<typeof setSessionPriceActionImpl>) {
  return setSessionPriceActionImpl(...args);
}

export async function setSessionPublicAction(...args: Parameters<typeof setSessionPublicActionImpl>) {
  return setSessionPublicActionImpl(...args);
}

export async function addRecurringClassesAction(...args: Parameters<typeof addRecurringClassesActionImpl>) {
  return addRecurringClassesActionImpl(...args);
}
