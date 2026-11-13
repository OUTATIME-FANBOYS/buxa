# ADR 0001: Backend stack

Status: proposed. Date: 2026-11-13.

## Context
The prototype keeps whole-app state in the browser and a single JSON file on a local server. That cannot
support multiple orgs, payments, concurrency-safe seat counts, or children's data.

## Decision
- **Language:** TypeScript end to end (reuses the pure domain code and tests).
- **Database:** PostgreSQL. Row-level security for tenant isolation, transactions and constraints for seat
  counts and holds. Managed host (Neon or Supabase) with point-in-time recovery.
- **API:** Fastify with typed routes and zod validation. Business rules stay in a pure `domain` package that
  the API calls; no rules in route handlers.
- **Data access:** Drizzle ORM with SQL migrations checked in; every migration reviewed in a PR.
- **Auth:** managed provider (Clerk or Supabase Auth), not hand-rolled, because accounts hold minors' data.
  Authorization is ours: a shared `can(actor, action, resource)` used by API and UI.
- **Payments:** Stripe Connect (Standard accounts). Webhooks are idempotent and verified.
- **Jobs:** Postgres-backed queue (pg-boss) for reminders and webhooks. No extra infrastructure at first.
- **Repo:** npm workspaces: `apps/web`, `apps/api`, `packages/domain`, `packages/db`.
- **Observability:** structured logs, error tracking, request ids, audit log table.

## Why not
- Firebase or document stores: weak fit for relational capacity and payments rules.
- Microservices: one deployable API until a measured reason appears.
- Hand-rolled auth: risk is too high for this data.

## Test strategy
1. Unit tests on `domain` (fast, no I/O).
2. Integration tests against a real Postgres in CI (migrations applied from scratch).
3. Tenant-isolation tests: every table, every role, both orgs.
4. Concurrency tests: N parallel registrations against capacity K never exceed K.
5. Playwright end-to-end for the main flows, plus axe accessibility checks.
6. Stripe in test mode with webhook replay.
