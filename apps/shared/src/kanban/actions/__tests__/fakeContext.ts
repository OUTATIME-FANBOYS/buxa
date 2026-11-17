import type { AppState } from '../../..';
import type { ActionContext } from '../context';

/** An in-memory ActionContext for testing the action groups without React. */
export function fakeContext(initial: AppState): ActionContext & { get: () => AppState } {
  let state = initial;

  return {
    get: () => state,
    set: (fn) => {
      state = fn(state);
    },
    replace: (next) => {
      state = next;
    },
  };
}
