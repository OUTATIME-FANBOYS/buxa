import type { User } from '../../types';
import * as D from '../../lib/domain';
import { DEMO_PASSWORD } from '../../lib/seed';
import { uid } from '../../lib/tasks';
import { sha } from '../hash';
import type { ActionContext } from './context';

/** Auth needs async hashing, so it reads state through `get`. */
export function authActions({ set, get }: ActionContext) {
  const switchUser = (userId: string) => set(s => ({ ...s, session: { userId }, ui: D.uiFor(s, userId) }));
  return {
    async signIn(email: string, password: string): Promise<string | null> {
      const e = email.trim().toLowerCase(); const acc = get().accounts.find(a => a.email.toLowerCase() === e);
      if (!acc) return 'No account found for that email.';
      const ok = acc.demo ? password === DEMO_PASSWORD : (await sha(acc.email + ':' + password)) === acc.hash;
      if (!ok) return 'That password is not correct.';
      switchUser(acc.userId); return null;
    },
    async signUp(name: string, email: string, password: string): Promise<string | null> {
      const e = email.trim().toLowerCase();
      if (get().accounts.some(a => a.email.toLowerCase() === e)) return 'An account with that email already exists.';
      const hash = await sha(e + ':' + password);
      set(s => D.signUp(s, { userId: 'u-' + uid(), workspaceId: 'w-' + uid(), projectId: 'p-' + uid(), name: name.trim(), email: e, hash }));
      return null;
    },
    signOut: () => set(s => ({ ...s, session: { userId: null } })),
    switchUser,
    updateProfile: (patch: Partial<Pick<User, 'name' | 'title'>>) => set(s => ({ ...s, users: s.users.map(u => (u.id === s.session.userId ? { ...u, ...patch } : u)) })),
  };
}
