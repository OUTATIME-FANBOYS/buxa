// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSeed } from '@/logic/common';
import { type AppState } from '@/logic/common';
import { useAutosave } from '../useAutosave';

const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/logic/composers/kanban/persistence', () => ({ storage: { save: h.save }, loadState: () => undefined }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let status: string | undefined;
function Probe({ state }: { state: AppState }) { status = useAutosave(state); return null; }

describe('useAutosave', () => {
  let root: Root;
  const seed = buildSeed();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    status = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('does not save on the first render', () => {
    act(() => root.render(<Probe state={seed} />));
    act(() => { vi.advanceTimersByTime(500); });
    expect(h.save).not.toHaveBeenCalled();
    expect(status).toBe('saved');
  });
  it('saves shortly after a change and reports saved again', () => {
    act(() => root.render(<Probe state={seed} />));
    act(() => root.render(<Probe state={{ ...seed, ui: { ...seed.ui, theme: 'dark' } }} />));
    expect(status).toBe('saving');
    act(() => { vi.advanceTimersByTime(260); });
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(status).toBe('saved');
  });
});
