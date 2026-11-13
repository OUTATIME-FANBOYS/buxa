import { agentActions } from './agents';
import { authActions } from './auth';
import type { ActionContext } from './context';
import { dataActions } from './data';
import { structureActions } from './structure';
import { taskActions } from './tasks';
import { uiActions } from './ui';

/** Binds the pure domain to React state. Actions are created once, so their identity is stable. */
export function createActions(ctx: ActionContext) {
  return { ...authActions(ctx), ...uiActions(ctx), ...taskActions(ctx), ...structureActions(ctx), ...agentActions(ctx), ...dataActions(ctx) };
}
export type Actions = ReturnType<typeof createActions>;
export type { ActionContext } from './context';
