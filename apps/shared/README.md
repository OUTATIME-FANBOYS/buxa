# apps/shared

The `@buxa/shared` package: pure logic that the web app, the middleware and the server all use. It holds the kanban domain (the app state, how the board view is derived from it, and the actions that change it), the camp navigation items, the attendance and class rules, dates and text helpers, and the help and install content. It has no React, no Next.js and no database code.

## What it may import

The rules are in `test/architecture/packages.test.ts`. `apps/shared` may import from `shared`, `domain` and `contracts`. It must not import `react`, `react-dom`, `next`, `pg`, `server-only` or `@buxa/db`, and it must never import `apps/web`, `apps/middleware` or `apps/server`.

## Folders

- `kanban/`: the kanban domain. `types.ts` (`AppState`, `Task`, `Column`), `normalize.ts` (fills in fields a saved state may lack), `derive.ts` (`deriveView`, which builds the board view from the state and the camp role), `actions/` (`createActions`, which groups the task, structure, UI, data, auth and agent actions), `demo.ts` and `seed/` (demo data), plus helpers such as `boardDnd.ts`, `cardDrag.ts`, `agents*.ts` and `sync.ts`.
- `attendance/`: check-in and check-out rules and state: `checkInState.ts`, `checkOutState.ts`, `outcome.ts`, `refusals.ts`, `onSiteView.ts`, `exportHeaders.ts`.
- `classes/`: class parsing (`parse.ts`), import state, and copy.
- `camp/`: the camp navigation items (`navItems.ts`), abilities, and input rules.
- `people/`: person parsing.
- `auth/`: credential rules and messages.
- `help/`: help content, troubleshooting, and import and export help.
- `install/`: the install prompt rules and dismissal.
- `qr/`, `scanner/`, `timing/`: QR codes, the scanner logic, and timing helpers.
- `config/`: constants such as the theme storage key (`theme.ts`) and routes (`routes.ts`).
- Root files: `index.ts` (the barrel that re-exports the folders above), and helpers such as `dates.ts`, `time.ts`, `text.ts`, `csv.ts`, `name.ts`, `tones.ts`, `theme.ts`, `motion.ts`, `focus.ts` and `actionState.ts`.

## Entry points

- `src/index.ts`: the barrel, imported as `@buxa/shared`.
- Subpath imports, for example `@buxa/shared/kanban/actions/createActions` and `@buxa/shared/config/theme`.
- `kanban/derive.ts`: `deriveView`, and `KANBAN_ROLE_FOR_CAMP`.
- `kanban/actions/createActions.ts`: `createActions`.

## Known issue

Seven non-test files in `kanban/` import the barrel (`'../..'`), while the barrel re-exports `kanban/`. That makes a cycle between `index.ts` and `kanban/`. The architecture test does not catch it because it checks package-level cycles only. Importing the file a symbol lives in, rather than the barrel, removes the cycle.

## Tests

From the repository root:

- `npm test` runs every test.
- `npm run test:unit` runs all of them except the database tests (this package has none).

Tests sit in `__tests__/` folders beside the code (`src/__tests__/`, `src/kanban/__tests__/`, and so on).

## Diagrams

- [Folders and main imports](docs/diagrams/shared-structure.html)
- [From the saved state to the kanban view](docs/diagrams/shared-state-derivation.html)
