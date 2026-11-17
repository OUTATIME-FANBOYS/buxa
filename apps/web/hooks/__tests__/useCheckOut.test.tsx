// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCheckOut } from '../useCheckOut';

const h = vi.hoisted(() => ({ checkOutAction: vi.fn() }));
vi.mock('@/logic/composers/attendance/checkOut', () => ({ checkOutAction: h.checkOutAction }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useCheckOut>;
let api: Api | undefined;
function Probe() { api = useCheckOut('p-1'); return null; }

describe('useCheckOut', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<Probe />));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; });

  it('starts closed and opens its panel on request', () => {
    expect(api!.state.phase).toBe('closed');
    act(() => api!.open());
    expect(api!.state.phase).not.toBe('closed');
    act(() => api!.close());
    expect(api!.state.phase).toBe('closed');
  });
  it('records changes to the draft as they are made', () => {
    act(() => api!.open());
    act(() => api!.patch({ collectedBy: 'g-2' }));
    expect('draft' in api!.state && api!.state.draft.collectedBy).toBe('g-2');
  });
  it('sends the check-out for this person and records the answer', async () => {
    h.checkOutAction.mockResolvedValueOnce({ kind: 'forbidden', message: 'No.' });
    act(() => api!.open());
    await act(async () => { await api!.submit({ collectedBy: null, overrideReason: null }); });
    expect(h.checkOutAction).toHaveBeenCalledWith(expect.objectContaining({ personId: 'p-1' }));
    expect(api!.state.phase).toBe('failed');
  });
});
