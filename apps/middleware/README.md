# apps/middleware

The `@buxa/middleware` package: the React hooks and providers that connect the UI in `apps/web` to the logic in `@buxa/shared`. It runs in the browser. It holds the app state store (its state lives in `localStorage` and is saved automatically), the toast and dialog state, the theme, and the hooks that screens use for check-in, task commands and drag and drop.

## What it may import

The rules are in `test/architecture/packages.test.ts`. `apps/middleware` may import from `middleware`, `shared`, `domain` and `contracts`. It must not import `server`, `db`, `pg` or `server-only`, and never `apps/web`. The package is client code, so nothing it reaches may import `@buxa/server`.

## Folders

- `providers/`: the React providers and their state.
  - `store.tsx`: `StoreProvider` and `useStore()`. `useStore()` returns the state, the actions and `deriveView(state, campRole)`.
  - `useStoreEngine.ts`: holds the state, a ref to the latest copy, and the actions made by `createActions` from `@buxa/shared`. Every change goes through its `set`.
  - `useAutosave.ts`, `useTheme.ts`: save the state after it stops changing, and apply the theme to `<html data-theme>`.
  - `UiProvider.tsx`: toasts and the confirm dialog. The web app passes its own `Dialog` in.
  - `TaskDrawerContext.tsx`: which task the drawer shows.
  - `AppProviders.tsx`, `WorkProviders.tsx`, `WorkGate.tsx`: stack the app-wide providers and the work-page providers. `WorkGate` renders nothing until the signed-in person is set as the board's user.
- `hooks/`: screen hooks. For example `useCheckIn.ts` runs the check-in flow through actions the web app passes in, `useTaskCommands.ts` covers move, duplicate, archive and delete with their toasts and undo, and `useBoardDnd.ts` handles drag and drop.
- `store/persistence.ts`: the `localStorage` adapter. `loadState()` reads the saved state (or the demo data if nothing usable is saved), and `storage.save()` writes it.

## Entry points

- `hooks/hooks.ts`: the hooks barrel, imported as `@buxa/middleware/hooks/hooks`.
- `providers/providers.ts`: the providers barrel, imported as `@buxa/middleware/providers/providers`.
- `providers/store.tsx`: `useStore()`.
- `providers/useStoreEngine.ts`: the state engine.

## Tests

From the repository root:

- `npm test` runs every test.
- `npm run test:unit` runs them all (this package has no database tests).

Tests sit in the `__tests__/` folders beside the code (`hooks/__tests__/`, `providers/__tests__/`, `store/__tests__/`).

## Diagrams

- [Folders and import direction](docs/diagrams/middleware-structure.html)
- [A hook sends an action and the store updates](docs/diagrams/middleware-action.html)
