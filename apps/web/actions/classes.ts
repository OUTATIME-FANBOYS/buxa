'use server';
import { cancelEnrolmentAction as cancelEnrolmentActionImpl } from '@buxa/server/composers/classes/cancelEnrolmentAction';
import { enrolAction as enrolActionImpl } from '@buxa/server/composers/classes/enrolAction';
import { importClassesAction as importClassesActionImpl } from '@buxa/server/composers/classes/importClassesAction';
import { createClassAction as createClassActionImpl } from '@buxa/server/composers/classes/createClassAction';
import { addSessionAction as addSessionActionImpl } from '@buxa/server/composers/classes/addSessionAction';

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

export async function createClassAction(...args: Parameters<typeof createClassActionImpl>) {
  return createClassActionImpl(...args);
}

export async function addSessionAction(...args: Parameters<typeof addSessionActionImpl>) {
  return addSessionActionImpl(...args);
}
