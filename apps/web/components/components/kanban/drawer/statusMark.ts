import type { Column } from '@buxa/shared';

import type { StatusGlyph } from '@/components/atoms/Icon';

/*
 * One mark per status, used everywhere a status is shown (the pill, the dropdown and any later surface). A status is a project
 * column. The seeded names get their own mark; a column the owner named (or renamed) takes the mark for its kind.
 */
/** The five status colours. Each is a `--status-<colour>` token (and `--status-<colour>-ink` for text) in tokens.css. */
export type StatusColour = 'pink' | 'blue' | 'orange' | 'purple' | 'green';

export interface StatusMark {
  /** The line icon that stands for the status (StatusIcon). */
  glyph: StatusGlyph;
  colour: StatusColour;
}

// The one map from status to glyph and colour. To change a status, change it here; everything reads it through statusMark().
const BY_NAME: Record<string, StatusMark> = {
  backlog: { glyph: 'clock', colour: 'pink' },
  'to do': { glyph: 'send', colour: 'blue' },
  'in progress': { glyph: 'dashed-clock', colour: 'orange' },
  'in review': { glyph: 'search', colour: 'purple' },
  done: { glyph: 'circle-check', colour: 'green' },
};

// A column the owner named (or renamed) takes the mark of its kind: open is To Do, active In Progress, done Done.
const BY_KIND: Record<Column['kind'], StatusMark> = {
  open: BY_NAME['to do'],
  active: BY_NAME['in progress'],
  done: BY_NAME.done,
};

/** The mark for a column: by its name when it is one of the five seeded statuses, otherwise by its kind. */
export function statusMark(column: Column): StatusMark {
  return BY_NAME[column.name.trim().toLowerCase()] ?? BY_KIND[column.kind];
}
