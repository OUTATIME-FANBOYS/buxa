import type { PersonSummary } from '@buxa/contracts';

/** The name a person is shown by: first name, then family name. */
export const displayName = (person: Pick<PersonSummary, 'givenName' | 'familyName'>): string =>
  `${person.givenName} ${person.familyName}`;
