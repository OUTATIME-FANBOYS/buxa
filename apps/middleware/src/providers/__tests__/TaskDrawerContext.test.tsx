// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TaskDrawerProvider, useTaskDrawer } from '../TaskDrawerContext';
import { requirePresent } from '@buxa/domain';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useTaskDrawer>;
let api: Api | undefined;

function Probe() {
  api = useTaskDrawer();

  return null;
}

describe('TaskDrawerContext', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<TaskDrawerProvider><Probe /></TaskDrawerProvider>));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('starts with no task open', () => {
    expect(requirePresent(api, 'api').drawer).toBeNull();
  });
  it('opens an existing task or a new one with its starting values, and closes again', () => {
    act(() => requirePresent(api, 'api').openTask('t-1'));
    expect(requirePresent(api, 'api').drawer).toEqual({ id: 't-1', defaults: undefined });
    act(() => requirePresent(api, 'api').openTask('new', { columnId: 'c-1', due: '2027-07-10' }));
    expect(requirePresent(api, 'api').drawer).toEqual({ id: 'new', defaults: { columnId: 'c-1', due: '2027-07-10' } });
    act(() => requirePresent(api, 'api').closeTask());
    expect(requirePresent(api, 'api').drawer).toBeNull();
  });
  it('refuses to be used outside its provider', () => {
    expect(() => {
      function Bare() {
        useTaskDrawer();

        return null;
      } act(() => createRoot(document.createElement('div')).render(<Bare />));
    }).toThrow();
  });
});
