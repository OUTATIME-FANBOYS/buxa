/**
 * The form a session name is compared in: runs of spaces (and other whitespace) collapsed to one, the ends trimmed, and lower case.
 * "  Summer   2027 " and "summer 2027" are the same session name. The database index on classes uses the same rule in SQL
 * (migration 0052), so keep the two in step.
 */
export function sessionNameKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}
