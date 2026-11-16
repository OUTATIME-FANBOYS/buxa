import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { WorkGate } from '../WorkGate';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));

const user = { id: 'u-rosa', name: 'Rosa', email: 'rosa@example.com' };

describe('WorkGate', () => {
  beforeEach(() => { h.store = { s: buildSeed(), actions: { adoptSessionUser: vi.fn() } }; });

  it('renders nothing of the work area until the board has adopted the signed-in person', () => {
    expect(renderToStaticMarkup(<WorkGate user={user}><p>board</p></WorkGate>)).toContain('Loading…');
  });
  it('renders the work area once the session user matches', () => {
    h.store = { s: { ...buildSeed(), session: { userId: 'u-rosa' } }, actions: {} };
    expect(renderToStaticMarkup(<WorkGate user={user}><p>board</p></WorkGate>)).toBe('<p>board</p>');
  });
});
