import { Dialog as ConfirmDialog } from '@/components/components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { emptyFilter } from '@buxa/shared';
import { type Filter } from '@buxa/shared';
import { FilterBar } from '@/components/components/kanban';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

const seed = buildSeed();
const project = seed.projects[0];
const setFilter = () => undefined;

describe('FilterBar', () => {
  beforeEach(() => {
    h.store = {
      s: seed,
      actions: { deleteSavedFilter: () => undefined, saveFilter: () => undefined },
      members: [],
      me: null,
    };
  });

  it('offers the search and the filter chips, with the sort and saved views', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <FilterBar filter={emptyFilter} setFilter={setFilter} project={project} tags={[]} />
      </UiProvider>,
    );
    expect(html).toContain('aria-label="Filter tasks by title or description"');
    for (const label of ['Priority', 'Assignee', 'Status', 'Due', 'Tags']) {
      expect(html).toContain(`>${label}`);
    }
    expect(html).toContain('Manual order');
    expect(html).toContain('>Saved');
  });
  it('shows a count on a chip that is in use and offers Clear once a filter is active', () => {
    const filter: Filter = { ...emptyFilter, priorities: ['high', 'low'], q: 'form' };
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <FilterBar filter={filter} setFilter={setFilter} project={project} tags={[]} />
      </UiProvider>,
    );
    expect(html).toContain('<span class="chip-count">2</span>');
    expect(html).toContain('>Clear</button>');
  });
  it('hides the status chip on views that do not group by status', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <FilterBar filter={emptyFilter} setFilter={setFilter} project={project} tags={[]} showStatus={false} />
      </UiProvider>,
    );
    expect(html).not.toContain('>Status');
  });

  it('the filter row wraps and has a gap, so its controls never overlap; the sort and saved triggers size to their labels', () => {
    // Prettier breaks rules over several lines and uses single quotes, so the text is flattened before matching.
    const flat = (css: string) => css.replace(/\s+/g, ' ').replace(/['"]/g, '');
    const filters = flat(
      readFileSync(new URL('../../../../styles/features/kanban/filters.css', import.meta.url), 'utf8'),
    );
    expect(filters).toMatch(/\.filters \{ display: flex; flex-wrap: wrap; gap: var\(--s2\);/);
    expect(filters).toContain('.filters .buxa-chip-menu.button--icon-only { width: auto;');
    const responsive = flat(readFileSync(new URL('../../../../styles/responsive.css', import.meta.url), 'utf8'));
    expect(responsive).not.toContain('.filters { flex-wrap: nowrap; overflow-x: auto;');
    expect(responsive).toMatch(/\.filters \{ flex-wrap: wrap; \}/);
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <FilterBar filter={emptyFilter} setFilter={setFilter} project={project} tags={[]} />
      </UiProvider>,
    );
    expect(html).toMatch(
      /aria-label="Sort tasks"[^>]*class="button button--secondary button--icon-only chip buxa-chip-menu"/,
    );
  });
});
