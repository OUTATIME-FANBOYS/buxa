import { Dialog as ConfirmDialog } from '@/components/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { type Task } from '@buxa/shared';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Discussion } from '@/components/components/kanban/drawer';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const userById = (id?: string) => seed.users.find(u => u.id === id);
const members = seed.users.map(u => ({ id: u.id, name: u.name }));

describe('Discussion', () => {
  beforeEach(() => {
    h.store = { actions: {} };
  });

  it('starts on the comments tab with an invitation when there are none', () => {
    const task = { ...seed.tasks[0], comments: [] } as Task;
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Discussion task={task} ro={false} members={members} userById={userById} />
      </UiProvider>,
    );
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('No comments yet.');
    expect(html).toContain('aria-label="Write a comment"');
  });
  it('marks the chosen tab with a soft background in a small rounded rectangle, with no border and no focus ring on click', () => {
    const task = { ...seed.tasks[0], comments: [] } as Task;
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Discussion task={task} ro={false} members={members} userById={userById} />
      </UiProvider>,
    );
    const on = html.match(/<button[^>]*aria-selected="true"[^>]*>/)?.[0] ?? '';
    expect(on).toContain('bg-[var(--surface-3)]!');
    expect(on).toContain('rounded-[var(--r-1)]!');
    expect(on).not.toContain('border-[var(--accent)]');
    expect(on).toContain('buxa:outline-none!');
    expect(on).toContain('buxa:focus-visible:outline-2!');
  });
  it('highlights @mentions in a comment and names its author', () => {
    const task = {
      ...seed.tasks[0],
      comments: [{ id: 'c-1', authorId: seed.users[0].id, body: 'Ask @Tom', at: '2027-07-01T00:00:00.000Z' }],
    };
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Discussion task={task} ro members={members} userById={userById} />
      </UiProvider>,
    );
    expect(html).toMatch(/<mark class="mention [^"]*">@Tom<\/mark>/);
    expect(html).toContain(`<strong>${seed.users[0].name}</strong>`);
    expect(html).not.toContain('aria-label="Write a comment"');
  });
  it('lists the activity history on its own tab', () => {
    const task = {
      ...seed.tasks[0],
      history: [{ id: 'h-1', at: '2027-07-01T00:00:00.000Z', actorId: seed.users[0].id, text: 'created this' }],
    } as unknown as Task;
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Discussion task={task} ro members={members} userById={userById} />
      </UiProvider>,
    );
    expect(html).toContain('role="tab"');
    expect(html).toContain('class="thread ');
    expect(html).not.toContain('class="history"');
  });
});
