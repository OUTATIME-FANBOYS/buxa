'use server';
import { createFormAction as createFormActionImpl } from '@buxa/server/composers/registration/formActions';
import { updateFormAction as updateFormActionImpl } from '@buxa/server/composers/registration/formActions';
import {
  deleteFormAction as deleteFormActionImpl,
  publishFormAction as publishFormActionImpl,
  removeFormFileAction as removeFormFileActionImpl,
} from '@buxa/server/composers/registration/formActions';
import { submitRegistrationAction as submitRegistrationActionImpl } from '@buxa/server/composers/registration/submitRegistrationAction';
import { confirmRegistrationAction as confirmRegistrationActionImpl } from '@buxa/server/composers/registration/confirmRegistrationAction';
import { recordPaymentAction as recordPaymentActionImpl } from '@buxa/server/composers/registration/paymentAction';
import { reviewDocumentAction as reviewDocumentActionImpl } from '@buxa/server/composers/registration/documentActions';
import {
  archiveRegistrationAction as archiveRegistrationActionImpl,
  deleteRegistrationAction as deleteRegistrationActionImpl,
  unarchiveRegistrationAction as unarchiveRegistrationActionImpl,
  withdrawRegistrationAction as withdrawRegistrationActionImpl,
} from '@buxa/server/composers/registration/lifecycleActions';

// Server action wrappers for the registration screens. Client components import this module, never @buxa/server. Next.js allows only
// async functions to be exported from a 'use server' file, so each action is wrapped rather than re-exported.

export async function createFormAction(...args: Parameters<typeof createFormActionImpl>) {
  return createFormActionImpl(...args);
}

export async function updateFormAction(...args: Parameters<typeof updateFormActionImpl>) {
  return updateFormActionImpl(...args);
}

export async function removeFormFileAction(...args: Parameters<typeof removeFormFileActionImpl>) {
  return removeFormFileActionImpl(...args);
}

export async function reviewDocumentAction(...args: Parameters<typeof reviewDocumentActionImpl>) {
  return reviewDocumentActionImpl(...args);
}

export async function deleteFormAction(...args: Parameters<typeof deleteFormActionImpl>) {
  return deleteFormActionImpl(...args);
}

export async function publishFormAction(...args: Parameters<typeof publishFormActionImpl>) {
  return publishFormActionImpl(...args);
}

export async function submitRegistrationAction(...args: Parameters<typeof submitRegistrationActionImpl>) {
  return submitRegistrationActionImpl(...args);
}

export async function confirmRegistrationAction(...args: Parameters<typeof confirmRegistrationActionImpl>) {
  return confirmRegistrationActionImpl(...args);
}

export async function recordPaymentAction(...args: Parameters<typeof recordPaymentActionImpl>) {
  return recordPaymentActionImpl(...args);
}

export async function withdrawRegistrationAction(...args: Parameters<typeof withdrawRegistrationActionImpl>) {
  return withdrawRegistrationActionImpl(...args);
}

export async function archiveRegistrationAction(...args: Parameters<typeof archiveRegistrationActionImpl>) {
  return archiveRegistrationActionImpl(...args);
}

export async function unarchiveRegistrationAction(...args: Parameters<typeof unarchiveRegistrationActionImpl>) {
  return unarchiveRegistrationActionImpl(...args);
}

export async function deleteRegistrationAction(...args: Parameters<typeof deleteRegistrationActionImpl>) {
  return deleteRegistrationActionImpl(...args);
}
