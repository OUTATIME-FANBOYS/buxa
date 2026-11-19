import type { Column } from '@buxa/shared';

/*
 * One mark per status, used everywhere a status is shown: the status dropdown's emoji and colour now, and any later surface
 * that names a status should import from here so the marks stay the same. A status is a project column. The seeded names get
 * their own mark; a column the owner named (or renamed) falls back to the mark for its kind (open, active, done).
 */
export interface StatusMark {
  emoji: string;
  /** Token class for the dropdown's border and text (fieldStyles in TaskProperties); the colour is set in tokens.css. */
  token: 'backlog' | 'todo' | 'progress' | 'review' | 'done';
}

const BY_NAME: Record<string, StatusMark> = {
  backlog: { emoji: '📥', token: 'backlog' },
  'to do': { emoji: '📝', token: 'todo' },
  'in progress': { emoji: '🔨', token: 'progress' },
  'in review': { emoji: '🔍', token: 'review' },
  done: { emoji: '✅', token: 'done' },
};

const BY_KIND: Record<Column['kind'], StatusMark> = {
  open: BY_NAME['to do'],
  active: BY_NAME['in progress'],
  done: BY_NAME.done,
};

/** The mark for a column: by its name when it is one of the five seeded statuses, otherwise by its kind. */
export function statusMark(column: Column): StatusMark {
  return BY_NAME[column.name.trim().toLowerCase()] ?? BY_KIND[column.kind];
}
