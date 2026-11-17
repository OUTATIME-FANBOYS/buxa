// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { useBoardDnd } from '../useBoardDnd';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useBoardDnd>;
let api: Api | undefined;
const seed = buildSeed();
function Probe() { api = useBoardDnd(seed.projects[0], seed.tasks.filter((t) => t.projectId === seed.projects[0].id), true); return null; }

describe('useBoardDnd', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    h.store = { actions: { moveTask: vi.fn(), moveColumn: vi.fn() } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<UiProvider><Probe /></UiProvider>));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts idle, with a scroller and handlers for cards and columns', () => {
    expect(api!.dnd.mode).toBe('idle');
    expect(api!.scroller).toBeTruthy();
    expect(typeof api!.grab).toBe('function');
    expect(typeof api!.columnDrag.start).toBe('function');
    expect(typeof api!.columnDrag.drop).toBe('function');
  });
});
