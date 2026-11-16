// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSeed } from '@/logic/common';
import { useStoreEngine } from '../useStoreEngine';

const h = vi.hoisted(() => ({ stop: vi.fn(), changed: vi.fn(), seed: null as null | ReturnType<typeof buildSeed> }));
vi.mock('@/logic/composers/kanban/persistence', () => ({ loadState: () => h.seed, storage: { save: () => undefined } }));
vi.mock('@/components/kanban/hooks/useAutosave', () => ({ useAutosave: () => 'saved' }));
vi.mock('@/components/kanban/hooks/useTheme', () => ({ useTheme: () => undefined }));
vi.mock('@/logic/common/kanban/sync', () => ({
  createSync: () => ({ changed: h.changed, stop: h.stop }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useStoreEngine>;
let api: Api | undefined;
function Probe() { api = useStoreEngine(); return null; }

describe('useStoreEngine', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    h.seed = buildSeed();
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts from the saved state and reports the autosave status', () => {
    act(() => root.render(<Probe />));
    expect(api!.state).toBe(h.seed);
    expect(api!.saveStatus).toBe('saved');
  });
  it('applies an action to the state and tells the server when it is syncing', () => {
    act(() => root.render(<Probe />));
    act(() => api!.actions.setTheme('dark'));
    expect(api!.state.ui.theme).toBe('dark');
    expect(h.changed).toHaveBeenCalled();
  });
  it('stops the sync when it unmounts', () => {
    act(() => root.render(<Probe />));
    act(() => root.unmount());
    expect(h.stop).toHaveBeenCalled();
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
});
