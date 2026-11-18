// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCheckOut } from '../useCheckOut';
import { requirePresent } from '@buxa/domain';

const h = vi.hoisted(() => ({ checkOutAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useCheckOut>;
let api: Api | undefined;
const actions = { checkOut: h.checkOutAction };

function Probe() {
  api = useCheckOut('p-1', actions);

  return null;
}

describe('useCheckOut', () => {
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<Probe />));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('starts closed and opens its panel on request', () => {
    expect(requirePresent(api, 'api').state.phase).toBe('closed');
    act(() => requirePresent(api, 'api').open());
    expect(requirePresent(api, 'api').state.phase).not.toBe('closed');
    act(() => requirePresent(api, 'api').close());
    expect(requirePresent(api, 'api').state.phase).toBe('closed');
  });
  it('records changes to the draft as they are made', () => {
    act(() => requirePresent(api, 'api').open());
    act(() => requirePresent(api, 'api').patch({ collectedBy: 'g-2' }));
    const state = requirePresent(api, 'api').state;
    expect('draft' in state && state.draft.collectedBy).toBe('g-2');
  });
  it('sends the check-out for this person and records the answer', async () => {
    h.checkOutAction.mockResolvedValueOnce({ kind: 'forbidden', message: 'No.' });
    act(() => requirePresent(api, 'api').open());
    await act(async () => {
      await requirePresent(api, 'api').submit({ collectedBy: null, overrideReason: null });
    });
    expect(h.checkOutAction).toHaveBeenCalledWith(expect.objectContaining({ personId: 'p-1' }));
    expect(requirePresent(api, 'api').state.phase).toBe('failed');
  });
});
