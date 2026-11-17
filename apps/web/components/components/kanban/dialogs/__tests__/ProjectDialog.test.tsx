import { Dialog as ConfirmDialog } from '@/components/components/export';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { ProjectDialog } from '@/components/components/kanban/dialogs/export';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown>, push: vi.fn() }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh() {} }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ProjectDialog', () => {
  let root: Root;
  const seed = buildSeed();
  beforeEach(() => {
    h.store = { actions: { createProject: vi.fn(() => 'p-new'), updateProject: vi.fn() }, workspace: seed.workspaces[0] };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('titles a new project', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ProjectDialog onClose={() => undefined} /></UiProvider>));
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('New project');
  });
  it('edits an existing project with its name filled in', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ProjectDialog project={seed.projects[0]} onClose={() => undefined} /></UiProvider>));
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Edit project');
    expect((document.querySelector('input') as HTMLInputElement).value).toBe(seed.projects[0].name);
  });
  it('refuses a blank name before creating anything', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ProjectDialog onClose={() => undefined} /></UiProvider>));
    act(() => { (document.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(document.querySelector('.field-error')?.textContent).toBe('Give the project a name.');
    expect((h.store.actions as { createProject: ReturnType<typeof vi.fn> }).createProject).not.toHaveBeenCalled();
  });
});
