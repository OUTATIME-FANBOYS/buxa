export const MAX_TITLE = 140;
export const TITLE_REQUIRED = 'A task needs a title.';
export const TITLE_TOO_LONG = 'Keep titles under 140 characters.';
export const DUE_BEFORE_START = 'Due date can’t be before the start date.';

/** The message for a bad task title, or undefined when it is fine. */
export function titleError(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return TITLE_REQUIRED;
  if (t.length > MAX_TITLE) return TITLE_TOO_LONG;
  return undefined;
}

/** The message when the due date is before the start date, or undefined. ISO dates compare as strings. */
export function datesError(start: string, due: string): string | undefined {
  return start && due && due < start ? DUE_BEFORE_START : undefined;
}
