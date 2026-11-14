import type { CheckOutInput } from '@buxa/contracts';
import type { CheckOutDraft } from './checkOutState';

/** Whether the panel may be submitted. A child needs a chosen guardian or a written override reason; an adult needs nothing. */
export function canSubmitCheckOut(minor: boolean, draft: CheckOutDraft): boolean {
  if (!minor) return true;
  return draft.collectedBy !== null || hasText(draft.overrideReason);
}

/** The Server Action's input for one row. The override reason is sent trimmed, and only when there is one. */
export function checkOutInputFor(personId: string, draft: CheckOutDraft): CheckOutInput {
  const reason = draft.overrideReason?.trim() ?? '';
  return {
    personId,
    ...(draft.collectedBy ? { collectedByPersonId: draft.collectedBy } : {}),
    ...(reason ? { overrideReason: reason } : {}),
  };
}

const hasText = (value: string | null): boolean => value !== null && value.trim() !== '';
