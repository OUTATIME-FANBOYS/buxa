# ADR 0002: Next.js, full stack

Status: accepted, in progress (steps 1 and 2 done). Date: 2026-11-13.

## Context
The web app was a Vite single-page app with hash routes (`#/camp`), and a separate Fastify API. Roadmap phases 2 and 3 need **public pages**
(event listings, registration) that must be server-rendered and indexable, with real URLs. A hash route cannot be indexed or shared.

## Decision
Move to **Next.js (App Router)** and put the API in it too:
- **Reads from the UI** are Server Components calling the services directly (no HTTP hop). **Mutations from the UI** are Server Actions.
- **`/v1/*` stays as the public REST API**, as Route Handlers, for other clients (a mobile app, agents). Same URLs and shapes as today (`@buxa/contracts`).
- Routes, Server Actions and Route Handlers all call one **services** layer, which calls repositories. Permissions (`authorize`) and row-level security are unchanged.
- `proxy.ts` (Next 16's middleware) refreshes the session and sets the Content-Security-Policy.
- Sessions move from a token in `localStorage` to cookies (`@supabase/ssr`), so server rendering can see who is signed in.
- Real URLs (`/camp`, `/camp/members`); the original kanban demo is a client-only section at `/kanban`.
- `packages/*` become npm workspaces. A single `config/routes.ts` (and later siblings) is the source of truth for anything used in more than one place.

## Order of work (each its own PR, tested end to end)
1. Foundation: Next.js replaces Vite for the screens, workspaces, real URLs. *(done)*
2. API into route handlers: services layer, `/v1` handlers, `proxy.ts` with a per-request-nonce CSP, tests ported, Fastify removed, Vercel build with migrations. *(done)*
3. Server rendering: cookie sessions, Server Components for reads, Server Actions for mutations.
4. Front-end organisation: feature folders, shared UI split into one file per component, single-source barrels (routes, copy, tokens).

## Consequences
- Deployment becomes plain Vercel (native Next.js): the custom Build Output tooling is removed; migrations move to a build/CI step.
- The Fastify API and its tests are rewritten against Web `Request`/`Response`; the repository, domain and contract layers carry over unchanged.
- Until step 2 lands, the app is not deployable (no API host). Nothing is deployed yet.
