import type { CheckOutInput } from '@buxa/contracts';
import type { CheckOutDraft } from './checkOutState';

/**
 * Whether the panel may be submitted. A known child needs a chosen guardian or a written override reason; an adult needs nothing.
 * When the screen cannot tell (null), it does not block: the server answers with what is missing.
 */
export function canSubmitCheckOut(minor: boolean | null, draft: CheckOutDraft): boolean {
  if (minor !== true) return true;
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
