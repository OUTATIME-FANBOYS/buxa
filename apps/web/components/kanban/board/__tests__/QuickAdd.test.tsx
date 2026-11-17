import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { QuickAdd } from '../QuickAdd';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

describe('QuickAdd', () => {
  beforeEach(() => {
    const seed = buildSeed();
    h.store = { actions: { createTask: () => 'x' }, me: seed.users[0] };
  });

  it('is a labelled box for a new task in the column, with Add and Done', () => {
    const seed = buildSeed();
    const html = renderToStaticMarkup(<QuickAdd project={seed.projects[0]} column={seed.projects[0].columns[1]} onDone={() => undefined} />);
    expect(html).toContain('aria-label="New task in To Do"');
    expect(html).toContain('placeholder="What needs doing?"');
    expect(html).toContain('>Add</button>');
    expect(html).toContain('>Done</button>');
  });
});
