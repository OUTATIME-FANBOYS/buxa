// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSeed } from '@buxa/shared';
import { ColumnDialog } from '@/components/components/kanban/dialogs/export';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Kept: the compiler needs this assertion to type the value; removing it fails typecheck.
const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ColumnDialog', () => {
  let root: Root;
  const seed = buildSeed();
  beforeEach(() => {
    h.store = { actions: { createColumn: vi.fn(), updateColumn: vi.fn() } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('titles a new column and offers to create it', () => {
    act(() => root.render(<ColumnDialog projectId={seed.projects[0].id} onClose={() => undefined} />));
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('New column');
    expect(document.querySelector('form button.button--primary')).not.toBeNull();
  });
  it('edits an existing column with its current name and kind', () => {
    const column = seed.projects[0].columns[0];
    act(() => root.render(<ColumnDialog projectId={seed.projects[0].id} column={column} onClose={() => undefined} />));
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Edit column');
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- Kept: querySelector returns the wider Element, and a plain ! would not narrow it to the type this test calls methods on.
    expect((document.querySelector('input') as HTMLInputElement).value).toBe(column.name);
  });
  it('refuses a blank name', () => {
    act(() => root.render(<ColumnDialog projectId={seed.projects[0].id} onClose={() => undefined} />));
    act(() => {
      // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- Kept: querySelector returns the wider Element, and a plain ! would not narrow it to the type this test calls methods on.
      (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('.field-error')?.textContent).toBe('Name the column.');
    expect((h.store.actions as { createColumn: ReturnType<typeof vi.fn> }).createColumn).not.toHaveBeenCalled();
  });
});
