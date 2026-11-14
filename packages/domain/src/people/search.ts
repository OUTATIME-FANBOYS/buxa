/** Most people a name search returns. The screen is a type-ahead, not a report. */
export const MAX_SEARCH_RESULTS = 20;

/** Case- and accent-insensitive form of a name or query: "José  GARCÍA" becomes "jose garcia". */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface SearchableName { givenName: string; familyName: string; preferredName: string | null }

/** Every word of the query must appear in the given, family or preferred name. The in-memory adapter uses this; Postgres mirrors it. */
export function matchesName(person: SearchableName, query: string): boolean {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return false;
  const haystack = normalizeForSearch([person.givenName, person.familyName, person.preferredName ?? ''].join(' '));
  return words.every(w => haystack.includes(w));
}
