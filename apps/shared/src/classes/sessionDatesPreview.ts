/*
 * What a session date change shows before it is saved: the classes that will fall outside the new dates (and be flagged), and the
 * ones with people on them (which refuse the save). Pure copy and types, shared by the server action and the Edit session dialog.
 */

/** The result of checking a date change. `outside` are the class names that will be flagged; `blocked` the ones that refuse it. */
export type SessionDatesPreviewState =
  { ok: true; outside: string[]; blocked: string[] } | { ok: false; message: string };

/** The dialog line before Confirm: "3 classes fall outside the new dates: Swim Stars, Art, Sailing." */
export function flaggedClassesSummary(names: readonly string[]): string {
  const list = names.join(', ');
  if (names.length === 1) {
    return `1 class falls outside the new dates: ${list}.`;
  }

  return `${names.length} classes fall outside the new dates: ${list}.`;
}

/** The toast action that opens the session's Classes tab. */
export function fixClassesLabel(count: number): string {
  return count === 1 ? 'Fix 1 class' : `Fix ${count} classes`;
}
