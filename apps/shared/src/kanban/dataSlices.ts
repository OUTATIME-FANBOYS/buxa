import type { AppState } from './types';

/**
 * The parts of the app's state that are shared with the server: everything about the work itself.
 * Who is signed in, which page is open and the theme stay per browser, so they are never synced.
 */
export const DATA_KEYS = [
  'users',
  'workspaces',
  'projects',
  'tasks',
  'activity',
  'notices',
  'savedFilters',
  'agents',
  'runs',
  'proposals',
] as const;
export type DataKey = (typeof DATA_KEYS)[number];
export type Data = Pick<AppState, DataKey>;

export const pickData = (s: AppState): Data => Object.fromEntries(DATA_KEYS.map(k => [k, s[k]] as const)) as Data;
export const isData = (d: unknown): d is Data =>
  !!d && typeof d === 'object' && DATA_KEYS.every(k => Array.isArray((d as Record<string, unknown>)[k]));

/**
 * Older agent-created tasks were saved without a description or priority (an explicit `undefined` overwrote the default).
 * Fill those in when data is loaded. Returns the same object when nothing needed repair.
 */
export function repairData<T extends Pick<AppState, 'tasks'>>(d: T): T {
  if (!d.tasks.some(t => t.description === undefined || t.priority === undefined)) {
    return d;
  }

  return {
    ...d,
    tasks: d.tasks.map(t =>
      t.description === undefined || t.priority === undefined
        ? {
            ...t,
            description: t.description ?? '',
            priority: t.priority ?? 'medium',
          }
        : t,
    ),
  };
}
