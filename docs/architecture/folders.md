# apps/web folder layers

This is the target layout for the restructure. It is a plan: no source file moves in this document. The file-by-file mapping is in `move-map.csv` next to this file.

## Layers

Paths are relative to `apps/web/`.

| Layer | Folder | What goes in | May import |
|---|---|---|---|
| app | `app/` | Next.js routes and route handlers. Stays where Next.js needs it. | `pages/`, `components/`, and the existing `server/`, `config/`, `styles/` |
| pages | `pages/` | Whole screens and page compositions (one folder per domain). | `components/`, `elements/`, `logic/composers/`, `logic/common/` |
| components | `components/` | Reusable composite UI built from elements: tables, panels, dialogs, shells, notices, empty and error states, forms, and React hooks used by them. | `elements/`, `logic/composers/`, `logic/common/` |
| elements | `elements/` | The smallest presentational pieces: buttons, pills, inputs, icons, avatars, progress bars, chart primitives. | `logic/common/` only |
| logic/composers | `logic/composers/` | Functions that combine services or repositories and shape data for a page or an action: loaders, view-model builders, server actions, storage and network adapters. | `logic/common/`, `server/` |
| logic/common | `logic/common/` | Pure helpers: dates, formatting, CSV, validation, ids, sorting, domain rules, state reducers. | nothing from the app layers (type-only imports from `server/` are allowed) |
| server | `server/` (existing) | Services, repositories, auth, HTTP helpers. Server-only. | `logic/common/` only |
| config, styles, packages | `config/`, `styles/`, `packages/*` (existing) | Unchanged. | n/a |

The QR helpers under `lib/qr/` are placed per file in `move-map.csv`: the SVG path builder goes to `logic/common/qr/`, the credential token helpers are server-only and go to `logic/composers/qr/`. `lib/` itself is retired once its files are placed.

### Import direction

Imports flow only downward. Same-layer imports are allowed. An import that points up is a violation.

```
app  ->  pages  ->  components  ->  elements  ->  logic/common
                      |                              ^
                      v                              |
                logic/composers  ------------------->+
                      |
                      v
                   server   (server-only, reads and writes data)
```

### Rules

1. **Imports flow only downward**, as in the diagram above. Routes import only from `pages/` or `components/` for feature code. Routes may still import `server/`, `config/` and `styles/`, which stay as they are.
2. **Logic never imports React.** No file under `logic/` imports `react`, `react-dom`, `next/*` components, or is a `.tsx` file. `logic/composers/` may contain `'use server'` action files, which are server functions and not React.
3. **Server stays server-only.** A file that imports `server-only`, or that calls a service or repository at runtime, lives in `server/` or `logic/composers/`. Nothing in `elements/`, `components/` or `logic/common/` may import one at runtime. Type-only imports from `server/` are allowed in `logic/common/`.
4. **Client components do not reach server-only code.** A file with `'use client'` may import a composer only if that composer is not `server-only`. See the barrel risk below.
5. **Components and pages do not call services or repositories directly.** They go through `logic/composers/`.
6. **Elements do not hold domain knowledge.** An element takes a tone, label or value as props. A domain-aware pill (for example an attendance status pill) is a component.

## Test rule

Every file in `elements/`, `components/`, `pages/`, `logic/common/` and `logic/composers/` has a unit test before it is moved. The test is either next to the file (`x.test.ts(x)`) or in a `__tests__/` folder beside it. A test counts only if it imports the file directly. Tests move with their subject, and their imports are updated in the same commit.

Process for each file: confirm or write the test in the old location and get it green, then `git mv` the file and its test, update imports to the new barrel, then run typecheck and tests.

`move-map.csv` records `has_test`. At the time of writing, 186 of the 264 non-retired source files have no direct test. The rule therefore blocks most of the moves until those tests exist (see Risks).

## Barrel rule

1. Each of the five layer folders has an `index.ts` that exports every public item in the folder, including items in its subfolders. The five barrels are `elements/index.ts`, `components/index.ts`, `pages/index.ts`, `logic/common/index.ts` and `logic/composers/index.ts`.
2. Code outside a layer imports only from its barrel: `@/elements`, `@/components`, `@/pages`, `@/logic/common`, `@/logic/composers`.
3. No deep imports across layers. `@/components/Dialog` from `pages/` is a violation; `@/components` is correct. Relative imports inside one layer are fine.
4. Barrels import downward only and never import each other in a loop.
5. Subfolders (for example `components/attendance/`) do not need their own barrel; the layer barrel re-exports them.
6. The `server-only` files are the exception to rule 1 that needs an owner decision (see Risks).

## Counts (current tree, from `move-map.csv`)

| Destination | Files |
|---|---|
| elements | 15 |
| components | 121 |
| pages | 22 |
| logic/common | 66 |
| logic/composers | 38 |
| split (one file, two new homes) | 2 |
| retired (barrels and the camp client subset, replaced by layer barrels) | 19 |
| **Total source files** | **283** |

Source files are the non-test `.ts` and `.tsx` files under `components/`, `features/`, `lib/` and `providers/`. Test files (55) are not rows in the map; each moves with its subject.

## Splits

- `features/attendance/lib/exportResponse.ts` goes to `logic/composers/attendance/exportResponse.ts` (the server call) and `logic/common/attendance/exportHeaders.ts` (the plain-text response, the byte-order mark and the headers).
- `features/kanban/lib/cardDrag.ts` goes to `logic/common/kanban/cardDrag.ts` (the pure drag state) and `components/kanban/hooks/useCardDrag.ts` (the `flushSync` from `react-dom`).

## Risks

**Circular imports.** A scan of the current import graph of the 283 source files found 0 cycles. The risk is new cycles once layer barrels exist. Mitigation: the barrel rules above, and a check in CI that no layer imports its own barrel.

**Files imported from more than one layer.** Six files are used from several layers.
- `features/kanban/types.ts` and `features/kanban/lib/tasks.ts` are used by components, elements, common, composers and pages. These are the domain core and belong in `logic/common/kanban/`. Expected, not a problem.
- `components/ui/tones.ts` is used by components, elements and common. It moves to `logic/common/` because `logic/` already imports it, so it cannot stay in `elements/`.
- `components/ui/Icon.tsx` is used by components and elements. It is fine because components may import elements.
- `features/kanban/components/charts/tone.ts` is used by components and elements. It is a type and moves to `elements/chartTone.ts`.
- `features/camp/forms/NewCampForm.tsx` is imported directly by the `(ops)/new` route and by the `(work)` route page. Both are allowed, but the route should import it from `components/`.

**Route files that import below the page layer.** Two routes import logic directly, which breaks rule 1:
- `app/(app)/camp/(ops)/attendance/export/route.ts` imports `exportResponse` (server call). Fix: the split in the plan, with the route calling a page-level export function, or a thin composer export through `pages/`.
- `app/(app)/camp/(work)/page.tsx` imports `loadCampHome` from the camp barrel. Fix: a page-level function in `pages/camp/` that wraps the loader.

**React internals in route files.** No route imports `react-dom` or any runtime React API. Four layout files (`app/layout.tsx`, `app/(app)/layout.tsx`, `app/(app)/camp/(ops)/layout.tsx`, `app/(app)/camp/(work)/layout.tsx`) import the `ReactNode` type from `react`. That is type-only and not a risk.

**React in logic.** `features/kanban/lib/cardDrag.ts` imports `react-dom` and is the one React import in logic. It is handled by the split above.

**Server-only files and barrels.** Six files import `server-only`: `features/attendance/lib/exportResponse.ts`, `features/attendance/lib/campActor.ts`, `features/people/lib/camp.ts`, `features/people/lib/loadPerson.ts`, `features/people/lib/loadHousehold.ts` and `lib/qr/tokens.ts`. If `logic/composers/index.ts` re-exports them, any client component that imports the barrel will fail to build. The barrel rule needs an owner decision: a separate server barrel, or a rule that client code imports composers only by name from a file that is not `server-only`.

**Barrel exposure of client code.** `components/index.ts` will mix `'use client'` components with server components. Importing it from a server component is fine. Keeping it out of the server bundle needs the same decision as above.

**Existing server import into logic.** `server/services/attendance/createAttendanceService.ts` imports `features/attendance/lib/csv`. After the move it imports `logic/common/csv.ts`. That is a server-to-logic import, which is allowed because csv is pure.

**Type-only server imports in logic/common.** `checkInState`, `checkOutState`, `card`, `onSiteView`, `refusals` and `homeCards` import types from `server/services` or from the camp client. These are accepted as a type-only exception to rule 3.

**Browser-touching files in logic/common.** `motion.ts`, `theme.ts`, `dismissal.ts` and `focus.ts` use `window`, `document`, `localStorage` or `navigator` but no React and no database. They fit the layer by the owner's definition. `theme.ts` is also a split candidate (its DOM side effect could move to a component hook).

**Duplicates to resolve later, not in this change.** `PageHeader` exists in `components/ui` and in `features/people`; `displayName` exists in `attendance/lib/name.ts` and `people/lib/format.ts`; dark mode is implemented three ways (`camp/components/useDarkMode.ts`, `kanban/state/useTheme.ts`, `lib/theme.ts`). The map keeps each copy where it is.

**Tests.** 186 of 264 non-retired source files have no direct test. The 55 existing test files import old paths (for example `components/ui/__tests__/server-safe.test.tsx` imports the `ui` barrel, and `server/__tests__/refusal.test.tsx` imports `features/auth/actions`); all of them need their imports updated in the same commit as the move.

**Next.js 16 breaking changes.** `apps/web/AGENTS.md` says to read `node_modules/next/dist/docs/` before writing code. There is no `node_modules` in this worktree, so those guides were not read. This document moves files only, but import path changes need a typecheck and a build to confirm.

## Decisions for the owner

1. **Hooks have no layer.** The five layers do not include React hooks. The plan puts them in `components/<domain>/` next to the components that use them. Alternative: add a `hooks/` layer.
2. **`providers/` is dissolved.** `AppProviders` moves to `components/`. `UiProvider` moves to `components/`. `WorkProviders` moves to `pages/kanban/`, because it wraps a page.
3. **QR helpers.** The plan puts `svg.ts` in `logic/common/qr/` and `tokens.ts` in `logic/composers/qr/`. The alternative is to keep `lib/qr/` as a sixth layer or move `tokens.ts` into `server/auth/`.
4. **`tones.ts` moves to `logic/common/`.** It is a pure token map that logic imports. Confirm this over keeping it in `elements/`.
5. **Two route imports** (export route and camp home page) need a page-level wrapper or an accepted exception.
6. **Server-only barrel strategy** (see Risks).
7. **Test rule.** 186 files need a test before they can move. Confirm whether to write them first, or accept indirect coverage for some layers.
8. **Renames.** `features/kanban/pages.tsx` becomes `pages/kanban/RoutePages.tsx` so that the file name does not repeat the layer name. `features/camp/client.ts` is retired.
9. **Test files** follow their subjects and are not rows in the map. Confirm.

## Owner decisions (confirmed)

1. **Hooks** live in `apps/web/hooks/`. Everything a component needs is exported through `apps/web/hooks/hooks.ts`. Hooks are not split across layers.
2. **Providers** stay in `apps/web/providers/`, exported through `apps/web/providers/providers.ts`. They are not folded into the layers.
3. **QR code** is split: pure helpers (rendering, format checks) in `logic/common`, and anything that touches the server (issuing, hashing with the secret, lookup) in `logic/composers`.
4. **Tones** move to `logic/common/tones.ts`. They stay framework-independent.
5. **Server-only code** is never re-exported through a client-accessible barrel. Each server-only module has an explicit server entry point (for example `server/index.server.ts`), and client barrels exclude it.
6. **Test-first rule** applies only to files being changed or moved. Existing untested files are not required to get tests first. New behaviour gets tests when it is introduced.
7. **Rename** `pages.tsx` to `RoutePages.tsx`.

Human-readable names are preferred over short ones, so each folder reads as its purpose: `elements`, `components`, `pages`, `logic/common`, `logic/composers`, `hooks`, `providers`.
