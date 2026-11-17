import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@/logic/common';
import { GlobalSearch } from '../GlobalSearch';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));

describe('GlobalSearch', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { s: seed, wsTasks: seed.tasks, userById: () => undefined };
  });

  it('is a labelled search box that shows the ⌘K shortcut', () => {
    const html = renderToStaticMarkup(<GlobalSearch inputRef={{ current: null }} />);
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Search all tasks"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('⌘K');
  });
  it('shows no results list until something is typed', () => {
    expect(renderToStaticMarkup(<GlobalSearch inputRef={{ current: null }} />)).not.toContain('role="listbox"');
  });
});
