import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../..';
import type { AppState } from '../../..';
import { authActions, type SessionIdentity } from '../auth';

function harness(initial: AppState) {
  let s = initial;
  const actions = authActions({ set: fn => {
    s = fn(s);
  }, get: () => s, replace: next => {
    s = next;
  } });

  return { actions, get: () => s };
}

const ada: SessionIdentity = { id: 'real-ada', name: 'Ada Lovelace', email: 'ada@example.com' };

describe('adoptSessionUser', () => {
  it('makes the signed-in person the current user, with their session identity', () => {
    const h = harness(buildSeed());
    h.actions.adoptSessionUser(ada);
    expect(h.get().session.userId).toBe('real-ada');
    expect(h.get().users.find(u => u.id === 'real-ada')).toEqual({ id: 'real-ada', name: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('leaves the seed people and workspaces alone', () => {
    const seed = buildSeed();
    const h = harness(seed);
    h.actions.adoptSessionUser(ada);
    expect(h.get().users.filter(u => u.id !== 'real-ada')).toEqual(seed.users);
    expect(h.get().workspaces).toEqual(seed.workspaces);
  });

  it('keeps an existing record, and its profile edits, when the person is already known', () => {
    const h = harness(buildSeed());
    h.actions.adoptSessionUser(ada);
    h.actions.updateProfile({ name: 'Ada L.' });
    h.actions.adoptSessionUser(ada);
    expect(h.get().users.filter(u => u.id === 'real-ada')).toEqual([{ id: 'real-ada', name: 'Ada L.', email: 'ada@example.com' }]);
  });
});
