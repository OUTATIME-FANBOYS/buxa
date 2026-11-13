# Phase 0: Foundation

Goal: a safe base to build every camp feature on. Nothing here is visible to camp staff yet.

## Glossary
- **Org**: one camp or organisation. The tenant. Every tenant row carries `org_id`.
- **Member**: a user's role inside an org: owner, admin, staff, viewer.
- **App role**: the restricted database role (`buxa_app`) that request handling runs as. It cannot bypass row-level security.

## Steps (each is its own PR)
| # | Step | Done when |
|---|---|---|
| 1 ✅ | Database foundation: Postgres, migrations, orgs, users, members, audit log, row-level security | Tenant-isolation tests pass in CI against real Postgres |
| 2 ✅ | Shared permissions: `can(actor, action, resource)` as a pure module with a role × action table test | Every role/action pair asserted |
| 3 ✅ | API skeleton (Fastify): health, request ids, structured logs, validated config | Integration test boots the app against Postgres |
| 4 | Auth: managed provider, session to actor, org selection | A user in two orgs sees only the selected one; forged org id rejected |
| 5 | Move the web app to `apps/web` and talk to the API | Existing board tests still pass |
| 6 | Staging deploy | Public URL; migrations run on deploy; rollback documented |

## Exit criteria
- Two orgs cannot read or write each other's data, for every table, proven by tests that run in CI.
- Audit log cannot be edited or deleted directly.
- CI is green on `main`; staging is live.

## Known tension (decided)
Audit rows are append-only, but deliberately deleting an org or user (erasure of a child's data) must still work.
Foreign-key actions are allowed; direct edits are not.

## Local setup
`cp .env.example .env`, `docker compose up -d db`, `export DATABASE_URL=...`, `npm run db:migrate`, `npm test`.
Without `DATABASE_URL` the database tests are skipped, so say so when reporting results.

## Running the API
`npm run api` (default `http://127.0.0.1:8788`; needs `DATABASE_URL`). `/health` is liveness, `/ready` checks the database.
