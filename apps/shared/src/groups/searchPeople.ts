/** A name folded for search: accents removed, case lowered, and the spaces at its ends trimmed. */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** True when the name contains the query, ignoring case and accents. A blank query matches every name. */
export function matchesPersonName(name: string, query: string): boolean {
  const needle = foldForSearch(query);

  return needle === '' || foldForSearch(name).includes(needle);
}
