# Buxa

Camp and membership management: people and households, sessions, registration, check-in, and a staff task board.
Built phase by phase; see `docs/ROADMAP.md`. The repository is public, so it holds **mock data only** until the privacy work in `docs/deploy.md` is done.

**Stack:** Next.js (App Router) · TypeScript · Postgres with row-level security · Supabase sign-in. See `docs/adr/`.

## Run it locally
```bash
npm install
docker compose up -d db                       # Postgres on 127.0.0.1:5433
cp apps/web/.env.example apps/web/.env.local  # then fill in the two public Supabase values; DATABASE_URL is already set for the local database
npm run db:migrate
npm run dev                                   # http://localhost:5173  (the web app and the API are one Next.js app)
```
`npm run typecheck`, `npm test` (database tests need `DATABASE_URL`), `npm run build`, `npm start`. The first request to each page in dev mode compiles it, so give a fresh start a moment.

## Layout
```
apps/web          Next.js app: app/ (routes), features/ (auth, camp, kanban), components/ui (shared UI), providers/, styles/, config/ (single sources), server/ (API, sessions, services)
packages/domain   pure rules: roles, permissions, slugs, ids
packages/db       migrations, transactions, tenant isolation
packages/contracts  zod shapes shared by the API and the web app
docs/             roadmap, ADRs, auth, deploy
```
Rules for the code are in `CODING_STANDARDS.md`; how to contribute is in `CONTRIBUTING.md`.

## The staff task board
The original kanban demo lives at `/kanban`. It is client-only and keeps its data in the browser. Demo accounts use the password `demo1234`.
Its old single-user server (`npm run server`, with an MCP endpoint for agents) is optional: set `NEXT_PUBLIC_LEGACY_SYNC=true` to let the board sync with it.
