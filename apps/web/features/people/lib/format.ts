/** A camp-local day (YYYY-MM-DD) as "3 Jul 2027". Parsed as UTC so no browser time zone can shift the day. */
export const formatLocalDate = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** An instant (ISO text) as a short date and time. */
export const formatInstant = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "Anna Lee", or with a preferred name "Anna Lee (Annie)". */
export const displayName = (p: { givenName: string; familyName: string; preferredName: string | null }): string =>
  p.preferredName ? `${p.givenName} (${p.preferredName}) ${p.familyName}` : `${p.givenName} ${p.familyName}`;
