# Coding standards

Short, checkable rules. Reviews cite these by name. Anything a tool can enforce should be enforced by the tool (`tsc`, tests, CI), not by memory.

## Layout
```
apps/api        Fastify HTTP API          apps/web        React app (camp area in src/camp; original kanban in the rest)
packages/domain pure rules, no I/O         packages/db     migrations, transactions, tenant isolation
packages/contracts  zod shapes shared by API and web
```
- **Dependencies point inward:** `apps/*` may import `packages/*`; `domain` imports nothing; `contracts` imports only `domain`; `db` imports only `domain`.
- Import packages by name (`@buxa/domain`, `@buxa/db`, `@buxa/contracts`), never by relative path across packages.
- One concern per file. If a file needs a section comment to separate jobs, split it. Aim for under ~120 lines per file and ~30 per function.
- Inside `apps/api/src`: `http/` (request/response plumbing), `auth/`, `<aggregate>/` (a repository interface + its Postgres adapter), `routes/` (one file per resource), `audit/`.
- Inside `apps/web/src/camp`: `api/`, `auth/`, `state/`, `hooks/`, `forms/`, `lib/`, `screens/`. A screen is one component per file.

## Types
- `strict` TypeScript. No `any`, no `as unknown as`, no `!` non-null assertions. If a type cannot prove it, restructure so it can (return a non-null type from a function that checks, pass the value as a prop).
- Data crossing a boundary is validated, not cast: request bodies and responses use the `@buxa/contracts` zod schemas; token claims use zod; database rows are typed with `query<Row>`.
- Closed sets are unions or `as const` arrays (`Role`, `Action`, `AuditAction`), never loose strings. Business rules shared by API and web live in `@buxa/domain` once (`isUuid`, `isSlug`, `authorize`).

## No implicit state machines
- Two or more booleans/strings that together describe "where we are" (`busy` + `error` + `done`) are a state machine. Model it as a discriminated union with a reducer, and test the transitions (`forms/submission.ts` is the pattern).
- `useState` is fine for independent values (a text field, an open/closed menu).

## Patterns we use, and when
- **Pure core, thin shell.** Rules are pure functions (`authorize`, reducers, validators). I/O happens at the edges.
- **Repository interface + adapter** for persistence. Introduce an interface only when there are two implementations (here: Postgres and in-memory); otherwise a plain function is enough.
- **Ports for outside systems** (`Verifier` for the identity provider).
- **Domain errors, not driver errors.** Adapters translate (`SlugTakenError`); HTTP code maps domain errors to statuses.
- Route handlers do four things only: parse → authorize → call a repository → return. No SQL, no rules.

## Tenant data and security
- Tenant tables have `org_id`, forced row-level security and a policy; the schema test fails if a new table lacks them.
- Request code touches tenant data only through `withOrg()`. Cross-tenant lookups (sign-in, org creation) are listed in `docs/auth.md`.
- Secrets never enter the repo or the web bundle. Only publishable keys go in `VITE_*` variables. Logs never contain headers, cookies, tokens or query strings.
- Every write that matters records an audit entry through `recordAudit`.

## Tests
- A rule gets a unit test at its seam. A permission gets a role × action test. A new state machine gets a transition table test.
- Database tests need `DATABASE_URL`; CI sets it and fails if it is missing, so they can never skip silently.
- Prefer real signed tokens and a real database; use in-memory adapters to test routes without one.

## Git
- Branch from `develop`, small PRs, squash-merge, conventional titles (see `CONTRIBUTING.md`). Commits use the GitHub no-reply email.
- Only source and docs are committed. Dependencies, build output, env files, local data and editor/OS files are ignored.
