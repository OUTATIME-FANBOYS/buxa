'use server';
import { createFormAction as createFormActionImpl } from '@buxa/server/composers/registration/formActions';
import { updateFormAction as updateFormActionImpl } from '@buxa/server/composers/registration/formActions';
import { publishFormAction as publishFormActionImpl } from '@buxa/server/composers/registration/formActions';
import { submitRegistrationAction as submitRegistrationActionImpl } from '@buxa/server/composers/registration/submitRegistrationAction';

// Server action wrappers for the registration screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function createFormAction(...args: Parameters<typeof createFormActionImpl>) {
  return createFormActionImpl(...args);
}

export async function updateFormAction(...args: Parameters<typeof updateFormActionImpl>) {
  return updateFormActionImpl(...args);
}

export async function publishFormAction(...args: Parameters<typeof publishFormActionImpl>) {
  return publishFormActionImpl(...args);
}

export async function submitRegistrationAction(...args: Parameters<typeof submitRegistrationActionImpl>) {
  return submitRegistrationActionImpl(...args);
}
