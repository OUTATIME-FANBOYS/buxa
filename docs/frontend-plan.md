# Steps 3 and 4: server rendering and front-end organisation

Status: in progress. Branch: `integration/steps-3-4`. Context: `docs/adr/0002-nextjs.md`.

Step 3 moves the camp area to **cookie sessions, Server Components and Server Actions** (the browser stops holding tokens; public, indexable pages become possible).
Step 4 **organises the front end** so each thing is defined once and lives in an obvious place.
They are planned together because they touch the same code, and split into chunks that different agents can build at the same time without editing the same files.

## Target structure

```
apps/web/
  app/                  routes only: thin page/layout/route files that import from features
  components/ui/        shared, feature-agnostic UI: one file per component + index.ts (the one import surface)
  features/<name>/      auth, camp, kanban. Each: components/, actions/, hooks/, lib/, index.ts (its public surface)
  providers/            composition roots: the single place providers are stacked (AppProviders)
  lib/                  framework-agnostic helpers shared by features (motion, text, actions/state)
  config/               single sources: routes, env, security (+ copy/nav as they appear); index.ts barrel
  styles/               tokens.css, base.css, components/*.css, features/*.css; one entry imported by the root layout
  server/               server-only: runtime, services, repositories, session, http
```
Rules: import a feature only through its `index.ts`; import shared UI only from `@/components/ui`; import config only from `@/config`; a URL, permission, rule, cookie name or
piece of copy is defined once and imported. `app/` never holds logic. A file that does two jobs is split (about 120 lines is the signal).

## Decisions (step 3)
- **HttpOnly cookie sessions via `@supabase/ssr`**: sign-in, sign-up and sign-out are Server Actions; `proxy.ts` refreshes the session; the browser never sees a token.
  (Today the token sits in `localStorage`, readable by any script that gets in.)
- `getSession()` takes the access token from the cookie and verifies it with **our** verifier (signature, issuer, audience, expiry), then loads the user and memberships. Cookie contents are never trusted unchecked.
- **`/v1` stays bearer-token only**: it is the public API for non-browser clients. The UI does not call it; it calls services directly (reads in Server Components, writes in Server Actions). No cookie auth on `/v1` means no CSRF surface there. Next.js itself checks `Origin` against `Host` for Server Actions.
- The selected camp is an HttpOnly cookie (`buxa-camp`), validated against memberships on every request.
- Forms use `useActionState` with the single `ActionState` type (`lib/actions/state.ts`); the hand-rolled submission reducer is retired.

## Frozen contracts (built in the planning step; chunks code against them)
| Contract | File | Implemented by | Used by |
|---|---|---|---|
| Session API: `getSession`, `requireSession`, `getCurrentCamp`, `rememberCamp`, `toActor`, `CAMP_COOKIE` | `apps/web/server/session/index.ts` (bodies are STUBS that throw) | A1 | B1, B2 |
| `<NewCampForm first />` | `apps/web/features/camp/forms/NewCampForm.tsx` (STUB) | B2 | B1 |
| `<RenameCampButton campId currentName />` | `apps/web/features/camp/forms/RenameCampButton.tsx` (STUB) | B2 | B1 |
| `ActionState`, `idle`, `success`, `failure`, `fieldError` | `apps/web/lib/actions/state.ts` (real) | done | A1, B2 |
| Shared UI surface `@/components/ui` (names exported today stay exported) | `apps/web/components/ui/index.ts` | A2 | everyone |
| Config surface `@/config` | `apps/web/config/index.ts` | done | everyone |
Contract changes go through the integrator (the person merging), never by an agent editing a file it does not own.

## Chunks

Every chunk gets its own git worktree and branch, and opens a PR **into `integration/steps-3-4`**, not `develop`. File ownership is exclusive: if you need a change in a file you do not own, say so in your report; do not make it.

### A1: Auth and sessions (step 3)
- **Owns:** `apps/web/server/session/**`, `apps/web/server/auth/**` (extend only), `apps/web/proxy.ts`, new `apps/web/features/auth/**`, `apps/web/app/(app)/sign-in/**`, `@supabase/ssr` in `package.json`.
- **Delivers:** the real session module (replace the STUB bodies, keep every signature); `@supabase/ssr` server client with HttpOnly cookies; session refresh in `proxy.ts` (keep the CSP behaviour intact); Server Actions `signIn`, `signUp`, `signOut` returning `ActionState`; a sign-in page (server component) that redirects when already signed in and renders a client `SignInForm` (the existing sign-in look and copy, `useActionState`); `features/auth/index.ts`; tests (session verification with real signed tokens, cookie validation, tampered/expired cookies refused, camp cookie validated against memberships, actions' error mapping, no account-existence leak).
- **Must not touch:** `features/camp/**`, `components/**`, `styles/**`, `features/kanban/**`, `app/(app)/camp/**`.
- **Done when:** typecheck, `npx vitest run`, `npm run build` pass; the old browser-token code in `features/camp` is untouched (the integrator removes it).

### A2: Shared UI library (step 4)
- **Owns:** `apps/web/components/**`, new `apps/web/lib/motion.ts` and `apps/web/lib/text.ts`, deletion of `features/kanban/components/{ui,Icon}.tsx` **at the end**.
- **Delivers:** split `features/kanban/components/ui.tsx` (286 lines of mixed concerns) and `Icon.tsx` into `components/ui/<Component>.tsx`, one per component, behind `components/ui/index.ts` exporting **every name exported today** (plus new types). Each file is a client module only if it needs to be (Pill, Avatar, Empty, Field, Progress, Icon must be importable from a **Server Component**). Separate concerns that are tangled today: (1) the generic `UiProvider` offers `toast`, `confirm`, `sidebarOpen/setSidebarOpen` only; (2) the kanban-only task-drawer state (`drawer`, `openTask`, `closeTask`) is **extracted** to `features/kanban/state/TaskDrawerContext.tsx` (new file, you may create it) and **also kept in `UiProvider`, marked `@deprecated`**, until the integrator removes it; (3) `PriorityMark` and priority helpers move to a new `features/kanban/components/PriorityMark.tsx` and stay re-exported from the barrel, deprecated; (4) generic motion moves to `lib/motion.ts` and `initials` to `lib/text.ts`, leaving one-line re-export shims in `features/kanban/lib/motion.ts` and `features/kanban/lib/tasks.ts`. Pure parts get unit tests.
- **Must not touch:** any other existing file under `features/kanban/**` (other than the shims above and deleting the two old files), `features/camp/**`, `styles/**`, `server/**`, `app/**`.
- **Done when:** typecheck, tests and build pass; `Pill`, `Avatar`, `Empty`, `Field`, `Icon` import cleanly into a throwaway Server Component (prove it in a build, then remove the throwaway); every previously exported name still resolves; behaviour unchanged.

### A3: CSS architecture (step 4)
- **Owns:** `apps/web/styles/**` (new), `apps/web/app/globals.css` (becomes a thin entry or is replaced), the CSS import line in `apps/web/app/layout.tsx`.
- **Delivers:** split the 414-line `globals.css` (17 commented sections) into `styles/tokens.css` (the single source for colours, spacing, radii, type, motion), `base.css`, `components/*.css` (buttons-fields, popover-menu-dialog, toasts, signals, table), `layout/*.css` (shell, pages), `features/{kanban,camp}.css`, and `responsive.css` or per-file media queries, with one entry file defining the **import order, which preserves today's cascade**. **No class names, token names or values change.** Document the layering and where new styles go in a header comment of the entry file.
- **Must not touch:** any `.tsx`/`.ts` other than the one CSS import in `app/layout.tsx`.
- **Done when:** before/after **full-page screenshots are pixel-identical** for: `/sign-in`, `/kanban` (demo login "Continue as Maya Chen"; then dashboard, a board with the task drawer open, calendar, agents), in light and dark, at 1280 and 375 wide. Keep the comparison script out of the repo; report the numbers.

### A4: Kanban feature breakdown (step 4)
- **Owns:** `apps/web/features/kanban/**` **except** `components/ui.tsx`, `components/Icon.tsx` (A2) and the shim lines A2 adds; `apps/web/app/kanban/**`.
- **Delivers:** reorganise into `features/kanban/{components,views,state,lib,hooks}/`, breaking down files that do several jobs (`Board.tsx`, `TaskDrawer.tsx`, `dialogs.tsx`, `Views.tsx`, `store.tsx`, `Shell.tsx`) into one component per file with names that say what they are; move the large `store.tsx` into `state/` by concern; update all internal imports; add `features/kanban/index.ts` as the public surface (`KanbanApp`); `app/kanban/page.tsx` imports only from it; remove implicit state machines you find (explicit unions or reducers, with tests); keep the existing tests passing (move them next to what they test). Switch every consumer of `useUi().openTask/closeTask/drawer` to a `useTaskDrawer()` hook backed by `features/kanban/state/TaskDrawerContext.tsx`: **coordinate with A2**, who creates that file; if it does not exist when you need it, create `useTaskDrawer` in `features/kanban/state/taskDrawer.tsx` and report the name so the integrator can reconcile.
- **Must not touch:** `components/**` (shared UI), `styles/**`, `features/camp/**`, `server/**`.
- **Done when:** typecheck, all existing kanban tests and `npm run build` pass; `/kanban` works in a browser (demo login, create/move/edit a task, dark mode, drag between columns).

### B1: Camp pages rendered on the server (step 3)
- **Owns:** `apps/web/features/camp/{screens,components}/**` (rewrite), `apps/web/providers/**` (new), `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/camp/{layout,page}.tsx`, `apps/web/app/(app)/camp/members/**`, `features/camp/index.ts`.
- **Delivers:** the camp area as Server Components calling the **session contract** and `getRuntime().services` directly (no HTTP, no client data fetching, no loading spinners): `camp/layout.tsx` calls `requireSession()` and `getCurrentCamp()`, renders the shell with the user, camps and current camp, and when there is no camp renders `<NewCampForm first />` (contract) instead of the page; `Overview` and `Members` are async server components using services and `toActor`; the shell is a server component with small client islands only where interaction needs them (camp switcher menu, account menu, sidebar toggle, theme toggle). The camp switcher calls a `selectCamp` Server Action **owned by B2** (`@/features/camp/actions` exports `selectCampAction(orgId)`; code against that name; if absent, stub locally and report). `Overview` renders `<RenameCampButton campId currentName />` (contract) only when `can(actor, 'org:update')`. `AppProviders` moves to `providers/` and stacks only what is still needed (UiProvider for toasts/confirm/sidebar). Use `loading.tsx` / `error.tsx` / `not-found.tsx` where the page wants them. Write the pieces so a **public (signed-out) layout** can reuse the shell later.
- **Must not touch:** `features/camp/{forms,actions}/**` (B2), `server/**`, `components/ui/**`, `styles/**`, `features/kanban/**`, `app/(app)/sign-in/**`. Do not delete the old `features/camp/{api,auth,state,hooks}` files; the integrator does.
- **Done when:** typecheck, tests, build pass. Because the session module is a stub until A1 merges, unit-test with a mocked `@/server/session`; the integrator runs the browser flows.

### B2: Camp mutations as Server Actions (step 3)
- **Owns:** `apps/web/features/camp/actions/**` (new), `apps/web/features/camp/forms/**` (replace `submission.ts`/`validators.ts` with the new forms), `apps/web/app/(app)/camp/new/**`.
- **Delivers:** `'use server'` actions `createCampAction`, `renameCampAction`, `selectCampAction(orgId)` taking `FormData`/args, using `requireSession()`, parsing input with the `@buxa/contracts` schemas (so the browser, server and API share one set of rules), calling `getRuntime().services.orgs.*` (add nothing to services without telling the integrator), `rememberCamp()` for selection, `revalidatePath()`, and returning `ActionState` (never throwing for expected failures; field errors mapped per field; a taken address is a field error on `slug`). Real `NewCampForm` and `RenameCampButton` (replacing the stubs, same props) as client forms using `useActionState`, the existing look and copy, address suggested from the name until edited (`suggestSlug`), accessible errors (`aria-invalid`, `role="alert"`). `features/camp/actions/index.ts`. Tests with a mocked session and service: every action's success, validation error, forbidden role, taken address, unauthenticated. The new-camp page renders `<NewCampForm first={false} />`.
- **Must not touch:** `features/camp/{screens,components}/**` (B1), `server/**`, `components/ui/**`, `styles/**`, `proxy.ts`.
- **Done when:** typecheck, tests, build pass.

### C: Integration and single-source sweep (the integrator, after the chunks merge)
Merge the chunk PRs into `integration/steps-3-4`; delete `features/camp/{api,auth,state,hooks}` and the old screens; remove the `@deprecated` shims and exports (task-drawer fields, `PriorityMark` from the barrel, `lib` shims) and fix their importers; sweep for values defined twice (header, cookie and role names, copy, nav items) and move them to `config/` or `@buxa/contracts`; run the full browser flows (owner, viewer, sign-out, reload), the production build with the strict CSP, and the failing-request scan; update the docs; open one PR into `develop`.

## Order and conflicts
All six chunks start together; they own disjoint files. Merge order into the integration branch: A3, A2, A4 (independent), then A1, B2, B1. The expected conflicts are small and known:
`package.json` / lockfile (A1 adds a dependency), `features/camp/index.ts` (B1) vs `features/camp/actions/index.ts` (B2), and `UiProvider` (A2) vs `useTaskDrawer` (A4). The integrator resolves them.

## Rules for every agent
- Read `apps/web/AGENTS.md` and the **bundled Next.js docs** (`node_modules/next/dist/docs/01-app/`: `guides/authentication.md`, `guides/forms.md`, `guides/server-actions.md`, `guides/content-security-policy.md`, `api-reference/04-functions/cookies.md`) before writing Next code. This is Next 16 and differs from older versions (`proxy.ts`, async `cookies()`/`headers()`/`params`).
- Follow `CODING_STANDARDS.md`: strict types, no `any`/`as unknown as`/`!`, no implicit state machines, one concern per file, single source of truth.
- Work in your own worktree and branch (`chunk/<id>-<name>`); run `npm ci` there first. Do not push to `develop` or `integration/steps-3-4`; open a PR into the latter. Conventional commit titles; end commit messages with the `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` line. Use the repo-local git identity (GitHub no-reply email); never the personal address.
- The shared local Postgres is `postgres://buxa:buxa@localhost:5433/buxa`. Do not reset it or delete other people's rows; tests use unique tags. Run any dev server on your own port (A1 5181, A2 5182, A3 5183, A4 5184, B1 5185, B2 5186).
- No real credentials exist for you. Never ask for, write or commit secrets, `.env*` files, the Supabase address, or personal data. Do not use any password you find in the conversation or logs.
- Verify with `npm run typecheck`, `npx vitest run`, `npm run build`. Report honestly: what you ran, what passed, what you could not verify, and any file outside your ownership you needed changed.
