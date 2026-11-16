# Coding standards

Short, checkable rules. Reviews cite these by name. Anything a tool can enforce should be enforced by the tool (`tsc`, tests, CI), not by memory.

Each rule describes the code on `develop` today. Where the rule is a **target** that the code does not follow yet, the text says so. Process for changing code is in [CONTRIBUTING.md](CONTRIBUTING.md).

## 1. Layout

```
apps/web            Next.js App Router app: app/ (routes), features/ (screens, actions, lib), server/ (services, repositories), components/ui, config/, styles/, providers/
packages/domain     pure rules and permissions, no I/O
packages/db         migrations, transactions, tenant isolation
packages/contracts  zod schemas shared by the server and the browser
docs/               roadmap, ADRs, security, auth, deploy, phase specs, audit
```

- **Dependencies point inward.** `domain` imports nothing. `contracts` and `db` import only `domain`. `apps/*` may import the packages.
- Packages are npm workspaces. Import them by name (`@buxa/domain`, `@buxa/db`, `@buxa/contracts`), never by relative path.
- Inside `apps/web`, import with the `@/` alias.

## 2. Next.js App Router

- **Routes stay thin.** `app/**/page.tsx`, `layout.tsx` and `route.ts` only wire things together. A route handler parses the request, finds the actor, calls a service and returns the result. The `authedRoute` wrapper in `server/http/route.ts` does this for `/v1` (see `app/v1/members/route.ts`).
- **Server Actions** are `'use server'` files under `features/<name>/actions/`. They validate input with a zod schema and call a service through `getRuntime()` (see `features/attendance/actions/checkIn.ts`).
- **Target: pages and components do not fetch data.** They receive data from a composer in `logic/composers/` (see the layers in section 3). Today some screens and routes still call the server directly: `app/(app)/camp/(work)/page.tsx` calls `loadCampHome`, `features/attendance/screens/AttendanceScreen.tsx` calls `getRuntime`, and `app/ready/route.ts` runs a query. New code does not add more of these.
- **Server-only code is marked.** A module that holds secrets, reads the database or runs a service imports `'server-only'`. Twelve modules do so today.
- **Target: explicit server entry points.** A server-only module is exported only through a server entry point (for example `server/index.server.ts`), never through a barrel that a Client Component can import. There are no `*.server.ts` entry points yet.
- **Client components import only client-safe modules.** Today `features/camp/client.ts` is the client-safe subset of the camp feature, and `features/camp/index.ts` (which pulls in server code) is for Server Components and routes only. Keep it that way: a server-only module is never re-exported through a client barrel.

## 3. Layers

The **target** layout is the layer plan below. The move to layers has not started. Today the code is organised as `features/<domain>/`, `components/ui/`, `server/`, `lib/` and `providers/`; the move to layers has not started. Until it does, the same import direction applies inside `features/`.

| Layer | Folder (target) | What goes in | May import |
|---|---|---|---|
| app | `app/` | Next.js routes and route handlers | `pages/`, `components/`, `server/` entry points, `config/`, `styles/` |
| pages | `pages/` | Whole screens, one folder per domain | `components/`, `elements/`, `logic/composers/`, `logic/common/`, `hooks/` |
| components | `components/` | Reusable composite UI: tables, panels, dialogs, notices, forms | `elements/`, `logic/composers/`, `logic/common/`, `hooks/` |
| elements | `elements/` | The smallest presentational pieces: buttons, pills, inputs, icons, chart primitives | `logic/common/` only |
| logic/composers | `logic/composers/` | Loaders, view-model builders, server actions, adapters that combine services | `logic/common/`, `server/` |
| logic/common | `logic/common/` | Pure helpers: dates, CSV, validation, sorting, domain rules, reducers | nothing from the app layers |
| hooks | `hooks/` | React hooks shared across layers | `logic/common/`, `logic/composers/` |
| providers | `providers/` | React context providers that wrap the app | `components/`, `logic/common/` |
| server | `server/` | Services, repositories, auth, HTTP helpers. Server-only | `logic/common/` only |

```
app  ->  pages  ->  components  ->  elements  ->  logic/common
                      |                              ^
                      v                              |
                logic/composers  ------------------->+
                      |
                      v
                   server   (server-only, reads and writes data)
```

Rules that apply once the layers exist:

1. Imports flow only downward. A same-layer import is allowed. An upward import is a violation.
2. `logic/` never imports React and is never a `.tsx` file. Server Action files in `logic/composers/` are server functions, not React.
3. Only `logic/composers/` and `server/` call services or repositories. Components and pages go through a composer.
4. Elements take a tone, label or value as props. A domain-aware pill (for example an attendance status) is a component.
5. Each layer folder has an `index.ts` barrel. Code outside a layer imports the barrel (`@/elements`, `@/logic/common`), never a file inside it. Barrels import downward only and never in a loop.
6. A type-only import from `server/` is allowed in `logic/common/`. A runtime import is not.

## 4. TypeScript

- **`strict` is on.** The root `tsconfig.json` sets `strict: true`, and `apps/web/tsconfig.json` extends it.
- **No `any`, no `as unknown as`.** A few uses remain in non-test code (for example `features/kanban/lib/agents.ts`). Do not add more; restructure the types instead.
- **No non-null assertions (`!`).** Some remain in non-test code, mostly in `legacy-server/` and `features/kanban/` (the demo). Do not copy them. If a type cannot prove a value, return a non-null type from a function that checks it, or pass the value as a prop.
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

## 6. Tests

- **Vitest is the unit test runner** for the whole repo (`npm test` runs `vitest run`). Unit tests sit next to the file (`x.test.ts`) or in a `__tests__/` folder beside it. A test counts only if it imports the file directly.
- **Test first for files being changed or moved.** Before a file is changed or moved, a test for its current behaviour is written (or confirmed) and is green. Tests move with their subject and their imports are updated in the same commit. Existing untested files need no test before an unrelated change.
- **New behaviour gets tests** when it is introduced. A rule gets a unit test at its seam. A permission gets a role × action test (`features/camp/lib/abilities.test.ts`). A new state machine gets a transition table test.
- **Postgres tests run only with `DATABASE_URL`.** They are `*.pg.test.ts` files or sit in `__tests__/`, and they use `describe.skipIf(!url)`, so `npm test` still works without a database on a laptop. CI sets `DATABASE_URL` for the whole `verify` job (`.github/workflows/ci.yml`). `packages/db/test/ci-guard.test.ts` fails the build in CI if the URL is missing, so no Postgres test skips silently there.
- **Prefer real signed tokens and a real database.** Use the in-memory repositories (`InMemory*Repository`) to test routes without one.
- **Structure tests** check that the database tables have tenant columns and forced row-level security (`packages/db/test/audit-and-catalog.test.ts`, `packages/db/test/narrow-privileges.test.ts`). They fail the build when a rule is broken.

## 7. Security basics

- **No secrets in the repo.** `.env` and `.env.*` are git-ignored; `apps/web/.env.example` (no values) is the only env file committed. Only publishable keys go in `NEXT_PUBLIC_*` variables. Everything else is read on the server and validated by `server/config.ts`.
- **Errors do not leak internals.** An unexpected error is logged and returned as a generic 500 (`server/http/route.ts`). Tests check that the database URL does not appear in a response.
- **Permission checks run in services.** A service calls `assertAllowed(actor, action, resource)` (`server/auth/authorize.ts`) before any read or write. The matrix is in `packages/domain`. The UI hides controls for convenience only; the server enforces the same rules.
- **Tenant data goes through `withOrg()`.** Tenant tables have `org_id` and forced row-level security. Cross-tenant lookups are listed in [auth.md](auth.md).
- **Every write that matters is audited** through `recordAudit` in the same transaction (`server/audit/recordAudit.ts`).
- **Children's data.** Phase 1 holds names, date of birth, household links and attendance. Collect only what the phase needs. Real children's data is not stored until every open item in [security.md](security.md) (section 6) is done. The repository holds mock data only.

## 8. UI

- **Colours come from the palette tokens** in `apps/web/styles/tokens.css` (`--accent`, `--ok`, `--warn`, `--crit`, `--agent`, `--f-*` for chart fills). Components do not hard-code a hex, rgb or hsl colour. The one exception is the black-and-white QR code on the badge (`features/badge/BadgeCard.tsx`), which scanners need. Some legacy CSS under `styles/layout/` still has hex values; do not add more.
- **Meaning is fixed.** Brand is primary and in progress, ok is done, warn needs attention, crit is overdue or destructive, agent is anything an AI agent did. Text colours meet 4.5:1 on their surface.
- **Touch targets are 44px.** `--control-h: 44px` is the one height for inputs, selects and buttons, and the minimum for any tap target.
- **Phones.** The phone breakpoint is `max-width: 720px`. The page never scrolls sideways. Inputs use `font-size: 16px` so iOS does not zoom. Tables stack into labelled rows on a phone.

## 9. Git

- Branch and PR naming, commit messages and the release process are in [CONTRIBUTING.md](CONTRIBUTING.md).
- Only source and docs are committed. Dependencies, build output, env files, local data and editor or OS files are ignored (`.gitignore`).
- Commits use the GitHub no-reply address.
