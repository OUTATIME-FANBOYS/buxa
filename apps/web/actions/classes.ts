'use server';
import { cancelEnrolmentAction as cancelEnrolmentActionImpl } from '@buxa/server/composers/classes/cancelEnrolmentAction';
import { enrolAction as enrolActionImpl } from '@buxa/server/composers/classes/enrolAction';
import { importClassesAction as importClassesActionImpl } from '@buxa/server/composers/classes/importClassesAction';
import { createClassAction as createClassActionImpl } from '@buxa/server/composers/classes/createClassAction';
import { addSessionAction as addSessionActionImpl } from '@buxa/server/composers/classes/addSessionAction';
import { settle } from '@buxa/domain';

// Server action wrappers for the classes screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export function cancelEnrolmentAction(...args: Parameters<typeof cancelEnrolmentActionImpl>) {
  return settle(() => {
    return cancelEnrolmentActionImpl(...args);
  });
}

export function enrolAction(...args: Parameters<typeof enrolActionImpl>) {
  return settle(() => {
    return enrolActionImpl(...args);
  });
}

export function importClassesAction(...args: Parameters<typeof importClassesActionImpl>) {
  return settle(() => {
    return importClassesActionImpl(...args);
  });
}

export function createClassAction(...args: Parameters<typeof createClassActionImpl>) {
  return settle(() => {
    return createClassActionImpl(...args);
  });
}

export function addSessionAction(...args: Parameters<typeof addSessionActionImpl>) {
  return settle(() => {
    return addSessionActionImpl(...args);
  });
}
