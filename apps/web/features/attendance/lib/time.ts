/**
 * Times on screen are always the camp's local time, from its IANA zone (`orgs.timezone`), never the server's or the browser's zone.
 * Every caller passes the camp's zone explicitly; there is no default.
 */
export function formatCampTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
}

/** Day and time, for example "13 Nov, 09:12". */
export function formatCampDateTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(instant));
}
