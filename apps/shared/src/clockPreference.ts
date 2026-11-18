import type { ClockFormat } from '@buxa/contracts';

/**
 * The clock the browser uses: 24-hour where its locale's hour cycle is h23 or h24, otherwise 12-hour. This is the default when
 * the person has not chosen one. Reads the browser only, so call it on the client.
 */
export function browserClockFormat(): ClockFormat {
  const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;

  return cycle === 'h23' || cycle === 'h24' ? '24h' : '12h';
}

/** The IANA time zone the browser is set to, for example "Europe/London". Nothing is stored: the local zone is always the default. */
export const localTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
