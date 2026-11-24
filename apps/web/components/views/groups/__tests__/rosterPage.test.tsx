// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@buxa/contracts';
import type { Roster } from '@buxa/domain';

// The printable roster: it renders each group and room with its names and roles, sits outside the camp shell (no sidebar), and
// its controls carry the no-print class. The composer is replaced with a fixed roster; the view and the sheet are real.
const h = vi.hoisted(() => ({
  actor: { userId: 'u1', orgId: 'o1', role: 'staff' as const },
  loaded: null as
    null | { ok: true; value: { session: Session; roster: Roster } } | { ok: false; reason: 'forbidden' | 'not-found' },
}));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('@buxa/server/composers/index.server', () => ({
  currentActor: () => Promise.resolve(h.actor),
  loadRoster: () => Promise.resolve(h.loaded),
}));

const { RosterPage } = await import('../RosterPage');

const SESSION: Session = {
  id: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f',
  name: 'Summer 1',
  description: '',
  startsOn: '2027-07-05',
  endsOn: '2027-07-17',
  classCount: 0,
  isPublic: false,
  archivedAt: null,
  createdAt: '2027-01-01T00:00:00.000Z',
};

const ROSTER: Roster = {
  groups: [
    {
      id: 'g1',
      name: 'Hawks',
      rooms: [
        {
          id: 'r1',
          name: 'Lodge 1',
          members: [
            { personId: 'p1', name: 'Ada Lovelace', role: 'camper' },
            { personId: 'p2', name: 'Mo Staff', role: 'staff' },
          ],
        },
      ],
    },
    {
      id: 'g2',
      name: 'Bears',
      rooms: [{ id: 'r2', name: 'Field', members: [{ personId: 'p3', name: 'Grace Hopper', role: 'camper' }] }],
    },
  ],
};

async function render(sessionId = SESSION.id): Promise<string> {
  return renderToStaticMarkup(await RosterPage({ sessionId }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
  h.loaded = { ok: true, value: { session: SESSION, roster: ROSTER } };
});

describe('printable roster page', () => {
  it('renders each group, its rooms, and the names and roles in them', async () => {
    const html = await render();

    expect(html).toContain('Roster: Summer 1');
    expect(html).toContain('2027-07-05 to 2027-07-17');
    expect(html).toContain('Hawks');
    expect(html).toContain('Lodge 1');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Mo Staff');
    expect(html).toContain('Bears');
    expect(html).toContain('Field');
    expect(html.indexOf('Hawks')).toBeLessThan(html.indexOf('Bears'));
  });

  it('draws no camp navigation: no sidebar, no topbar, only a link back and a Print button', async () => {
    const html = await render();

    expect(html).not.toMatch(/class="[^"]*\bsidebar\b/);
    expect(html).not.toMatch(/class="[^"]*\btopbar\b/);
    expect(html).toContain('Back to groups and rooms');
    expect(html).toContain('Print roster');
  });

  it('hides the controls in print with the no-print class', async () => {
    const html = await render();
    const actions = html.match(/<nav[^>]*roster-print-actions[^>]*>/);

    expect(actions?.[0]).toContain('no-print');
    expect(html).toMatch(/class="[^"]*no-print[^"]*"[^>]*>\s*Print roster/);
  });

  it('shows the empty message when no one is placed', async () => {
    h.loaded = { ok: true, value: { session: SESSION, roster: { groups: [] } } };
    const html = await render();

    expect(html).toContain('No one is placed in this session yet.');
  });

  it('shows a teacher the same notice as the Groups page', async () => {
    h.loaded = { ok: false, reason: 'forbidden' };
    const html = await render();

    expect(html).toContain('You cannot see this session.');
    expect(html).not.toContain('Ada Lovelace');
  });

  it('is not found when the session is not in the camp', async () => {
    h.loaded = { ok: false, reason: 'not-found' };

    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
