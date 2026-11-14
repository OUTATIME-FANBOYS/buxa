import type { PersonSummary } from '@buxa/contracts';
import type { OnSiteEntry, ScanResult } from '@/server/services';

/** A person as the check-in screen shows them: who, and since when they are on site (null when not). */
export interface PersonCard { person: PersonSummary; onSiteSince: string | null }

/** Answer to "what is this code or name?": one neutral unknown, or a person. */
export type Lookup = { kind: 'unknown' } | { kind: 'person'; card: PersonCard };

/** Pairs people with their arrival time, from the on-site list (the summary only says whether they are on site). */
export function cardsFor(people: readonly PersonSummary[], onSite: readonly OnSiteEntry[]): PersonCard[] {
  const since = new Map(onSite.map(row => [row.entry.personId, row.entry.checkedInAt]));
  return people.map(person => ({ person, onSiteSince: since.get(person.id) ?? null }));
}

/** A scan answer, with the arrival time attached when the person is on site. */
export function lookupFor(scan: ScanResult, onSite: readonly OnSiteEntry[]): Lookup {
  if (scan.kind === 'unknown') return { kind: 'unknown' };
  const [card] = cardsFor([scan.person], onSite);
  return card ? { kind: 'person', card } : { kind: 'unknown' };
}
