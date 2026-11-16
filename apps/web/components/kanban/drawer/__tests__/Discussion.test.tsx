import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { type Task } from '@/logic/common';
import { UiProvider } from '../../../UiProvider';
import { Discussion } from '../Discussion';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/components/kanban/state/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const userById = (id?: string) => seed.users.find((u) => u.id === id);
const members = seed.users.map((u) => ({ id: u.id, name: u.name }));

describe('Discussion', () => {
  beforeEach(() => { h.store = { actions: {} }; });

  it('starts on the comments tab with an invitation when there are none', () => {
    const task = { ...seed.tasks[0], comments: [] } as Task;
    const html = renderToStaticMarkup(<UiProvider><Discussion task={task} ro={false} members={members} userById={userById} /></UiProvider>);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('No comments yet.');
    expect(html).toContain('aria-label="Write a comment"');
  });
  it('highlights @mentions in a comment and names its author', () => {
    const task = { ...seed.tasks[0], comments: [{ id: 'c-1', authorId: seed.users[0].id, body: 'Ask @Tom', at: '2027-07-01T00:00:00.000Z' }] } as unknown as Task;
    const html = renderToStaticMarkup(<UiProvider><Discussion task={task} ro members={members} userById={userById} /></UiProvider>);
    expect(html).toContain('<mark class="mention">@Tom</mark>');
    expect(html).toContain(`<strong>${seed.users[0].name}</strong>`);
    expect(html).not.toContain('aria-label="Write a comment"');
  });
  it('lists the activity history on its own tab', () => {
    const task = { ...seed.tasks[0], history: [{ id: 'h-1', at: '2027-07-01T00:00:00.000Z', actorId: seed.users[0].id, text: 'created this' }] } as unknown as Task;
    const html = renderToStaticMarkup(<UiProvider><Discussion task={task} ro members={members} userById={userById} /></UiProvider>);
    expect(html).toContain('role="tab"');
    expect(html).toContain('class="thread"');
    expect(html).not.toContain('class="history"');
  });
});
