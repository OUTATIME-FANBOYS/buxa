import type { Session } from '@/server/auth/session';
import type { Role } from '@buxa/domain';
import { InMemoryStore } from '@/server/__tests__/fakes';
import { startRuntime } from '@/server/__tests__/harness';

/** A posted form from plain values. */
export function formOf(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

/** The real services over the in-memory repositories, plus helpers to make people and their sessions. */
export function startWorld() {
  const store = new InMemoryStore();
  const env = startRuntime({ repositories: store.asRepositories(), verifier: null });
  let counter = 0;
  return {
    store,
    stop: () => env.stop(),
    async person(): Promise<string> {
      counter += 1;
      return (await store.upsertFromIdentity({ authId: `auth-${counter}`, email: `p${counter}@example.test`, name: `Person ${counter}` })).id;
    },
    addMember(orgId: string, userId: string, role: Role) { store.members.push({ orgId, userId, role }); },
    /** What `requireSession` would return for this person right now. */
    async sessionOf(userId: string): Promise<Session> {
      const user = store.users.get(userId);
      if (!user) throw new Error('unknown person');
      return { user: { id: user.id, email: user.email, name: user.name }, memberships: await store.membershipsOf(userId) };
    },
  };
}
