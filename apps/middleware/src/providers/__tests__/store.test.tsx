// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSeed } from '@buxa/shared';
import { StoreProvider, useStore } from '../store';
import { requirePresent } from '@buxa/domain';

const seed = buildSeed();
const actions = { setTheme: vi.fn() };
vi.mock('../useStoreEngine', () => ({
  useStoreEngine: () => ({ state: seed, saveStatus: 'saved', sync: 'local', serverInfo: {}, actions }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useStore>;
let api: Api | undefined;

function Probe() {
  api = useStore();

  return null;
}

describe('StoreProvider and useStore', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined; root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('gives the state, the actions and what is derived from them to its children', () => {
    act(() => root.render(<StoreProvider><Probe /></StoreProvider>));
    expect(requirePresent(api, 'api').s).toBe(seed);
    expect(requirePresent(api, 'api').actions).toBe(actions);
    expect(requirePresent(api, 'api').saveStatus).toBe('saved');
    expect(requirePresent(api, 'api').sync).toBe('local');
    expect(requirePresent(api, 'api').myRole).toBe('viewer');
  });
  it('refuses to be used outside its provider', () => {
    expect(() => {
      act(() => root.render(<Probe />));
    }).toThrow('StoreProvider missing');
  });
});
