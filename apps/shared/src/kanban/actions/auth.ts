import type { User } from '../..';
import * as D from '../..';
import type { ActionContext } from './context';

/** The signed-in person as the server knows them. The kanban only ever learns this from the verified session. */
export interface SessionIdentity {
  id: string;
  name: string;
  email: string;
}

/**
 * The task board's current user is the signed-in person. Their record is added to the browser's people list the first time
 * they open the board, using their session name and email. Nobody else is added, and the seed's people are never changed here.
 * The account is the source of their name and email: each time the session says something different, the record follows it.
 * Their title stays with the board.
 */
export function authActions({ set }: ActionContext) {
  return {
    adoptSessionUser: (who: SessionIdentity) =>
      set(s => {
        const known = s.users.some(u => u.id === who.id);
        const users: User[] = known
          ? s.users.map(u => (u.id === who.id ? { ...u, name: who.name, email: who.email } : u))
          : [...s.users, { id: who.id, name: who.name, email: who.email }];
        const next = { ...s, users, session: { userId: who.id } };

        return { ...next, ui: D.uiFor(next, who.id) };
      }),
    updateProfile: (patch: Partial<Pick<User, 'name' | 'title'>>) =>
      set(s => ({ ...s, users: s.users.map(u => (u.id === s.session.userId ? { ...u, ...patch } : u)) })),
  };
}
