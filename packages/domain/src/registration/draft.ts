/**
 * Whether a registration form's draft differs from its published version (the "Unpublished changes" note on the Registration page).
 * Pure: the server passes in the two sets of values; the comparison says whether a publish would change anything families see.
 * The questions are compared in order, because the order is what families answer in.
 */

/** The values a publish copies from the draft: the name, the season, the covered sessions and the questions. */
export interface FormValues {
  name: string;
  season: string | null;
  sessionIds: readonly string[];
  /** The questions as stored (jsonb), in order. Compared as JSON, so the same stored shape compares equal. */
  fields: readonly unknown[];
}

/** True when the draft would publish something different from the published version. */
export function formDraftDiffers(draft: FormValues, published: FormValues): boolean {
  if (draft.name !== published.name || (draft.season ?? null) !== (published.season ?? null)) {
    return true;
  }
  if (!sameIds(draft.sessionIds, published.sessionIds)) {
    return true;
  }

  return JSON.stringify(draft.fields) !== JSON.stringify(published.fields);
}

/** Two session sets are the same when they hold the same ids, in any order and each once. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) {
    return false;
  }

  return [...left].every(id => right.has(id));
}
