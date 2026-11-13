import type { AppState } from '../../types';

/** What every group of actions needs: change state, read the latest state, or replace it wholesale. */
export interface ActionContext {
  set: (fn: (s: AppState) => AppState) => void;
  get: () => AppState;
  replace: (s: AppState) => void;
}
