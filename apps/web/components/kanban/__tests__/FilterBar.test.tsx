import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { emptyFilter } from '@buxa/shared';
import { type Filter } from '@buxa/shared';
import { FilterBar } from '../FilterBar';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const project = seed.projects[0];
const setFilter = () => undefined;

describe('FilterBar', () => {
  beforeEach(() => {
    h.store = { s: seed, actions: { deleteSavedFilter: () => undefined, saveFilter: () => undefined }, members: [], me: null };
  });

  it('offers the search and the filter chips, with the sort and saved views', () => {
    const html = renderToStaticMarkup(<UiProvider><FilterBar filter={emptyFilter} setFilter={setFilter} project={project} tags={[]} /></UiProvider>);
    expect(html).toContain('aria-label="Filter tasks by title or description"');
    for (const label of ['Priority', 'Assignee', 'Status', 'Due', 'Tags']) expect(html).toContain(`>${label}`);
    expect(html).toContain('Manual order');
    expect(html).toContain('>Saved');
  });
  it('shows a count on a chip that is in use and offers Clear once a filter is active', () => {
    const filter: Filter = { ...emptyFilter, priorities: ['high', 'low'], q: 'form' };
    const html = renderToStaticMarkup(<UiProvider><FilterBar filter={filter} setFilter={setFilter} project={project} tags={[]} /></UiProvider>);
    expect(html).toContain('<span class="chip-count">2</span>');
    expect(html).toContain('>Clear</button>');
  });
  it('hides the status chip on views that do not group by status', () => {
    const html = renderToStaticMarkup(<UiProvider><FilterBar filter={emptyFilter} setFilter={setFilter} project={project} tags={[]} showStatus={false} /></UiProvider>);
    expect(html).not.toContain('>Status');
  });
});
