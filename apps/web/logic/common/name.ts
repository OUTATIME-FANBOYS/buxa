import type { PersonSummary } from '@buxa/contracts';

/** The name a person is called on screen: preferred name if they have one, then family name. */
export const displayName = (person: Pick<PersonSummary, 'givenName' | 'familyName' | 'preferredName'>): string =>
  `${person.preferredName ?? person.givenName} ${person.familyName}`;
