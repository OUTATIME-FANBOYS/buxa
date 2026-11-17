import { Dialog as ConfirmDialog } from '@/components/components/export';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { AgentDialog } from '@/components/components/kanban/dialogs/export';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AgentDialog', () => {
  let root: Root;
  const seed = buildSeed();
  beforeEach(() => {
    h.store = { actions: { addAgent: vi.fn() }, workspace: seed.workspaces[0], projects: seed.projects };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('asks for a name, what the agent is for, and which projects it may touch', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><AgentDialog onClose={() => undefined} /></UiProvider>));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Add an agent');
    expect(dialog.querySelectorAll('input[type="checkbox"]')).toHaveLength(seed.projects.length);
    expect(dialog.textContent).toContain('Projects it may touch');
  });
  it('will not add an agent without a name', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><AgentDialog onClose={() => undefined} /></UiProvider>));
    const form = document.querySelector('form') as HTMLFormElement;
    act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(document.querySelector('.field-error')?.textContent).toBe('Give the agent a name.');
    expect(h.store.actions as { addAgent: ReturnType<typeof vi.fn> }).toBeTruthy();
    expect((h.store.actions as { addAgent: ReturnType<typeof vi.fn> }).addAgent).not.toHaveBeenCalled();
  });
});
