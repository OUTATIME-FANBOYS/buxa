import type { Column } from '@buxa/shared';

/*
 * One mark per status, used everywhere a status is shown: the status dropdown's emoji and colour now, and any later surface
 * that names a status should import from here so the marks stay the same. A status is a project column. The seeded names get
 * their own mark; a column the owner named (or renamed) falls back to the mark for its kind (open, active, done).
 */
/** The five status colours. Each is a `--status-<colour>` token (and `--status-<colour>-ink` for text) in tokens.css. */
export type StatusColour = 'pink' | 'blue' | 'orange' | 'purple' | 'green';

export interface StatusMark {
  emoji: string;
  colour: StatusColour;
}

// The one map from status to colour. To recolour a status, change its colour here; the pill, the dropdown and any later
// surface read it through statusMark().
const BY_NAME: Record<string, StatusMark> = {
  backlog: { emoji: '📥', colour: 'pink' },
  'to do': { emoji: '📝', colour: 'blue' },
  'in progress': { emoji: '🔨', colour: 'orange' },
  'in review': { emoji: '🔍', colour: 'purple' },
  done: { emoji: '✅', colour: 'green' },
};

// A column the owner named (or renamed) takes the colour of its kind: open is blue, active orange, done green.
const BY_KIND: Record<Column['kind'], StatusMark> = {
  open: BY_NAME['to do'],
  active: BY_NAME['in progress'],
  done: BY_NAME.done,
};

/** The mark for a column: by its name when it is one of the five seeded statuses, otherwise by its kind. */
export function statusMark(column: Column): StatusMark {
  return BY_NAME[column.name.trim().toLowerCase()] ?? BY_KIND[column.kind];
}
