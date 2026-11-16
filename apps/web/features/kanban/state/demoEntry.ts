import * as D from '../lib/domain';
import { loadState, storage } from './persistence';

export interface DemoUser { id: string; name: string; title?: string }

/** The demo accounts shown on the sign-in page: the first few with a demo login. Reads the browser's saved demo. */
export function demoUsers(): DemoUser[] {
  const s = loadState();
  return s.users
    .filter(u => s.accounts.some(a => a.userId === u.id && a.demo))
    .slice(0, 3)
    .map(u => ({ id: u.id, name: u.name, title: u.title }));
}

/** Choose a demo account for the task pages. Saves the choice where the task store reads it on load. */
export function enterDemo(userId: string): void {
  const s = loadState();
  storage.save({ ...s, session: { userId }, ui: D.uiFor(s, userId) });
}
