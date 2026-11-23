/** A camp-local day (YYYY-MM-DD) as "3 Jul 2027". Parsed as UTC so no browser time zone can shift the day. */
export const formatLocalDate = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** "Anna Lee": first name, then family name. */
export const displayName = (p: { givenName: string; familyName: string }): string => `${p.givenName} ${p.familyName}`;
