# Coding standards

Short, checkable rules. Reviews cite these by name. Anything a tool can enforce should be enforced by the tool (`tsc`, tests, CI), not by memory.

Each rule describes the code on `develop` today. Where the rule is a **target** that the code does not follow yet, the text says so. Process for changing code is in [CONTRIBUTING.md](CONTRIBUTING.md).

## 1. Layout

```
apps/web            Next.js app: app/ (routes only), actions/ (server action wrappers for client code), config/, styles/, proxy.ts,
                    components/ (all frontend: elements/, components/, views/; each folder has an export.ts)
apps/middleware     client-side React: hooks/ and providers/. No server code.
apps/server         the backend: services, repositories, auth, http, session, rate limiting, runtime and the composers
apps/shared         pure helpers: dates, CSV, tones, validation, ids, sorting, routes, theme, QR rendering. No React, no database
packages/domain     pure rules and permissions, no I/O
packages/db         migrations, transactions, tenant isolation
packages/contracts  zod schemas shared by the server and the browser
docs/               roadmap, ADRs, security, auth, deploy, phase specs, audit
```

- **Dependencies point one way.** `apps/web` imports `apps/middleware` and `apps/server`; both import `apps/shared`. `domain` imports nothing. `contracts` and `db` import only `domain`.
- Packages are npm workspaces. Import them by name (`@buxa/shared`, `@buxa/server`, `@buxa/middleware`, `@buxa/domain`, `@buxa/db`, `@buxa/contracts`), never by relative path. Subpaths work too (`@buxa/shared/dates`).
- Inside `apps/web`, import with the `@/` alias.

## 2. Next.js App Router

- **Routes stay thin.** `app/**/page.tsx`, `layout.tsx` and `route.ts` only wire things together. A route handler parses the request, finds the actor, calls a service and returns the result. The `authedRoute` wrapper in `server/http/route.ts` does this for `/v1` (see `app/v1/members/route.ts`).
- **Server Actions** are `'use server'` files. Composers live in `apps/server/src/composers/`, and client components call them through the wrappers in `apps/web/actions/`. They validate input with a zod schema and call a service through `getRuntime()` (see `features/attendance/actions/checkIn.ts`).
- **Target: pages and components do not fetch data.** They receive data from a composer in `logic/composers/` (see the layers in section 3). Today some screens and routes still call the server directly: `app/(app)/camp/(work)/page.tsx` calls `loadCampHome`, `features/attendance/screens/AttendanceScreen.tsx` calls `getRuntime`, and `app/ready/route.ts` runs a query. New code does not add more of these.
- **Server-only code is marked.** A module that holds secrets, reads the database or runs a service imports `'server-only'`. Twelve modules do so today.
- **Target: explicit server entry points.** A server-only module is exported only through a server entry point (for example `server/index.server.ts`), never through a barrel that a Client Component can import. There are no `*.server.ts` entry points yet.
- **Client components import only client-safe modules.** Today `features/camp/client.ts` is the client-safe subset of the camp feature, and `features/camp/index.ts` (which pulls in server code) is for Server Components and routes only. Keep it that way: a server-only module is never re-exported through a client barrel.
- **Route categories.** Every camp page sits in a route group named for its category, so the folder tree matches the sidebar. Route groups do not change URLs. A new page goes in the group for what it is for:

  | Group (folder under `app/(app)/camp/`) | Sidebar group | What goes in it |
  |---|---|---|
  | `(operations)` | Operations | The day-to-day camp operation: check-in, on site, people, attendance, classes and sessions (and the classes import page), help. |
  | `(work)` | Work | The staff board: my tasks, projects, boards, calendar, agents, reports. Also Home (`/camp`), which stays in this group because it shares the work shell. |
  | `(admin)` | Admin | Team access and settings, and the new-camp page. |
  | `(parent)` | not shown yet | **Reserved** for the parent portal (phase 6). Do not create the folder or add routes to it before phase 6. |

  Each group has a `layout.tsx`. A page directly in a group folder is allowed only for Home. `test/architecture/routeCategories.test.ts` fails when a page sits outside the listed groups, when two pages share a URL, when the parent group exists early, or when a sidebar link is filed in the wrong folder.

## 3. Layers and packages

Four packages do the work. Their imports point one way:

```
apps/web  ->  apps/middleware  ->  apps/shared
apps/web  ->  apps/server      ->  apps/shared
```

| Package and folder | What goes in | May import |
|---|---|---|
| web: `app/` | Next.js routes and route handlers. They wire things together and nothing more | `components/views`, `components/components`, `actions/`, `config/`, the packages |
| web: `components/elements/` | The smallest presentational pieces: buttons, pills, inputs, icons, chart primitives | `@buxa/shared` only |
| web: `components/components/` | Reusable composites: tables, panels, dialogs, notices, forms | `components/elements/`, the packages |
| web: `components/views/` | Whole screens and page compositions (formerly `views/` and `screens/`) | `components/components/`, `components/elements/`, the packages |
| web: `actions/` | `'use server'` wrappers that client components call instead of `@buxa/server` | `@buxa/server` |
| middleware: `src/hooks/`, `src/providers/` | Client-side React hooks and providers. Server calls arrive as arguments | `@buxa/shared` |
| server: `src/` | Services, repositories, auth, http, session, rate limiting, runtime, composers. Server-only | `@buxa/shared`, `@buxa/domain`, `@buxa/contracts`, `@buxa/db` |
| shared: `src/` | Pure helpers: dates, CSV, tones, validation, ids, sorting, routes, theme, QR rendering | `@buxa/domain`, `@buxa/contracts` |

The rules below are enforced by `test/architecture/architecture.test.ts` and `packages.test.ts`:

1. **Packages point one way.** `shared` and `server` never import `web` or `middleware`. `shared` imports neither React nor the database.
2. **Client code never reaches `@buxa/server`.** Client components call server actions through `apps/web/actions/`. Only server components, route handlers and `'use server'` files import `@buxa/server`. The test follows every module that client code can reach.
3. **Each components folder has an `export.ts`.** It re-exports the folder's public items. Code outside a folder imports its `export.ts`, never a file inside it.
4. **Routes use views and components.** A route file imports from `components/views` and `components/components`, not from `components/elements`.
5. **Only `apps/server` calls services or repositories.** Components and pages get their data through a composer or a server component.
6. **Server-only code stays out of client barrels.** A module that imports `server-only` is never re-exported through a client barrel.
7. **No import cycles,** between files or between packages.
8. **Type-only imports are erased,** so the rules above apply to runtime imports. Shared types still live in `@buxa/shared` where a client needs them.

## 4. TypeScript

- **`strict` is on.** The root `tsconfig.json` sets `strict: true`, and `apps/web/tsconfig.json` extends it.
- **No `any`, no `as unknown as`.** A few uses remain in non-test code (for example `features/kanban/lib/agents.ts`). Do not add more; restructure the types instead.
- **No non-null assertions (`!`).** Some remain in non-test code, mostly in the kanban demo (`components/components/kanban/`). Do not copy them. If a type cannot prove a value, return a non-null type from a function that checks it, or pass the value as a prop.
- **Validate at every boundary; do not cast.** Request bodies, Server Action inputs, environment variables (`server/config.ts`) and stored data are parsed with zod. Shared request and response shapes live in `packages/contracts`. Database rows are typed with `query<Row>`.
- **Closed sets are unions or `as const` arrays** (for example `Role` and `Action` in `packages/domain`). They are never loose strings.
- **Shared business rules are written once,** in `packages/domain` (for example `authorize`, `isUuid`, `isSlug`), and imported by the API and the web app.
- **Errors are recognised by a marker, not `instanceof`.** Next.js can load one server module more than once, so `instanceof` fails across copies. `HttpError` carries `kind = 'http-error'` and is checked with `isHttpError` (`server/http/errors.ts`). Other error classes follow the same pattern.
- **Domain errors, not driver errors.** Repository adapters translate database errors into domain errors. HTTP code maps domain errors to statuses.
- **No implicit state machines.** Two or more values that together say where a flow is (`busy` + `error` + `done`) are a discriminated union with a reducer, and the transitions are tested (`features/attendance/checkIn/checkInState.ts`, `checkOutState.ts`). Independent values such as a text field or an open menu may use `useState`.

## 5. Naming and files

- **Names are human-readable.** Name a file, function or folder for what it is for (`exportResponse`, `checkInState`), not an abbreviation. Components are `PascalCase.tsx`; modules are `camelCase.ts`.
- **One concern per file.** If a file needs a section comment to separate two jobs, split it. The aim is under about 120 lines per file and about 30 per function. This is guidance, not a lint rule: seven non-test files are longer today.
- **A feature exposes an `index.ts`.** Code outside `features/<name>/` imports from `@/features/<name>`, not from a deep path. Several folders have one today (`features/attendance`, `features/camp`, `server/services`).
- **Single source of truth.** A URL, permission, validation rule, theme key or piece of copy is defined once and imported everywhere. URLs come from `config/routes.ts`; permissions come from `packages/domain`; the theme storage key is in `config/theme.ts`. If you are about to write the same string a second time, move it first.

## 6. Lint
- Run `npm run lint` before pushing. CI runs it after typecheck and fails on any error. `npm run lint:fix` fixes what it can.
- Config: `eslint.config.mjs` (flat config, ESLint 9). Errors that must not come back:
  - `@typescript-eslint/no-explicit-any`: no `any`; use `unknown` and narrow it, or a real type.
  - `@typescript-eslint/no-unused-vars`: remove what is not used.
  - `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`: hooks at the top level, and dependency lists that are complete.
  - `jsx-a11y/alt-text` and `jsx-a11y/label-has-associated-control`: every image has alt text; every form label is tied to its control.
  - `no-console`: use `console.warn` or `console.error` in product code. Scripts, tests and CLI entry points may log.
- Warnings are debt, not permission: `@typescript-eslint/no-non-null-assertion` and the typescript-eslint type-checked rules are warnings until the existing code is cleared. Do not add new ones.
- Layer and package rules (section 3) are enforced by the architecture tests in `test/architecture/`.
- Do not disable a rule inline without a reason on the same line (`// eslint-disable-line rule -- reason`).

## 7. Tests

- **Vitest is the unit test runner** for the whole repo (`npm test` runs `vitest run`). Unit tests sit next to the file (`x.test.ts`) or in a `__tests__/` folder beside it. A test counts only if it imports the file directly.
- **Test first for files being changed or moved.** Before a file is changed or moved, a test for its current behaviour is written (or confirmed) and is green. Tests move with their subject and their imports are updated in the same commit. Existing untested files need no test before an unrelated change.
- **New behaviour gets tests** when it is introduced. A rule gets a unit test at its seam. A permission gets a role × action test (`features/camp/lib/abilities.test.ts`). A new state machine gets a transition table test.
- **Postgres tests run only with `DATABASE_URL`.** They are `*.pg.test.ts` files or sit in `__tests__/`, and they use `describe.skipIf(!url)`, so `npm test` still works without a database on a laptop. CI sets `DATABASE_URL` for the whole `verify` job (`.github/workflows/ci.yml`). `packages/db/test/ci-guard.test.ts` fails the build in CI if the URL is missing, so no Postgres test skips silently there.
- **Prefer real signed tokens and a real database.** Use the in-memory repositories (`InMemory*Repository`) to test routes without one.
- **Structure tests** check that the database tables have tenant columns and forced row-level security (`packages/db/test/audit-and-catalog.test.ts`, `packages/db/test/narrow-privileges.test.ts`). They fail the build when a rule is broken.

## 8. Security basics

- **No secrets in the repo.** `.env` and `.env.*` are git-ignored; `apps/web/.env.example` (no values) is the only env file committed. Only publishable keys go in `NEXT_PUBLIC_*` variables. Everything else is read on the server and validated by `server/config.ts`.
- **Errors do not leak internals.** An unexpected error is logged and returned as a generic 500 (`server/http/route.ts`). Tests check that the database URL does not appear in a response.
- **Permission checks run in services.** A service calls `assertAllowed(actor, action, resource)` (`server/auth/authorize.ts`) before any read or write. The matrix is in `packages/domain`. The UI hides controls for convenience only; the server enforces the same rules.
- **Tenant data goes through `withOrg()`.** Tenant tables have `org_id` and forced row-level security. Cross-tenant lookups are listed in [auth.md](auth.md).
- **Every write that matters is audited** through `recordAudit` in the same transaction (`server/audit/recordAudit.ts`).
- **Children's data.** Phase 1 holds names, date of birth, household links and attendance. Collect only what the phase needs. Real children's data is not stored until every open item in [security.md](security.md) (section 6) is done. The repository holds mock data only.

## 9. UI

- **Colours come from the palette tokens** in `apps/web/styles/tokens.css` (`--accent`, `--ok`, `--warn`, `--crit`, `--agent`, `--f-*` for chart fills). Components do not hard-code a hex, rgb or hsl colour. The one exception is the black-and-white QR code on the badge (`features/badge/BadgeCard.tsx`), which scanners need. Some legacy CSS under `styles/layout/` still has hex values; do not add more.
- **Meaning is fixed.** Brand is primary and in progress, ok is done, warn needs attention, crit is overdue or destructive, agent is anything an AI agent did. Text colours meet 4.5:1 on their surface.
- **Touch targets are 44px.** `--control-h: 44px` is the one height for inputs, selects and buttons, and the minimum for any tap target.
- **Phones.** The phone breakpoint is `max-width: 720px`. The page never scrolls sideways. Inputs use `font-size: 16px` so iOS does not zoom. Tables stack into labelled rows on a phone.

## 10. Git

- Branch and PR naming, commit messages and the release process are in [CONTRIBUTING.md](CONTRIBUTING.md).
- Only source and docs are committed. Dependencies, build output, env files, local data and editor or OS files are ignored (`.gitignore`).
- Commits use the GitHub no-reply address.
