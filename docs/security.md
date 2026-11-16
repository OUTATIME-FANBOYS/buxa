# Security and data protection

Status: **the app is not ready for real children's data.** Keep to mock data until the open items in
section 6 are done and the privacy review is signed off. This page says what is built, what is planned, and what is missing.

## 1. What we hold, and where

| Data | Examples | Stored in | Who can read it | Kept for |
|---|---|---|---|---|
| Sign-in credentials | email, password hash, sessions | Supabase Auth (never in our database) | the user only | while the account exists |
| Camp settings | camp name, slug, time zone | Postgres | camp members | while the camp exists |
| Staff access | role per camp | Postgres | camp admins and owners | while the membership exists |
| People (children, guardians, instructors) | names, roles, household links, date of birth | Postgres, row-level security per camp | staff and above; viewers see names and roles only | **not yet defined** (open item) |
| Contact details | email, phone | Postgres | staff and above (`people:read_contact`) | not yet defined |
| Memberships | start and end dates, revocation reason | Postgres | staff and above | not yet defined |
| Badges | token hash only (SHA-256 of a random 128-bit token) | Postgres | nobody can read the token back | until reissued or revoked |
| Attendance | check-in and check-out times, who checked them in | Postgres | staff and above | not yet defined |
| Audit log | who did what, when, to which record | Postgres, append-only | admins | not yet defined |
| Sample tasks (kanban demo) | task titles and comments | the user's browser (local storage) | the browser only | until cleared |

**Rule:** the demo kanban stores data only in the browser. It is never sent to the server, so it must not hold real data.

## 2. What is built

- **Tenant isolation:** every camp table has row-level security, forced on for the app's database role. A test fails if a new table lacks it. Cross-camp foreign keys are blocked by composite keys.
- **Least privilege, enforced now:**
  - In the database (migrations `0004` to `0009`): the request role `buxa_app` cannot read `schema_migrations`, is not a superuser and has no `BYPASSRLS` or `CREATEROLE`. It cannot insert or change users, organisations or memberships directly. It has no delete rights on people, memberships, badges, check-ins or households. Its only cross-organisation paths are three `SECURITY DEFINER` functions with a fixed search path, executable by `buxa_app` only: the sign-in user row, the sign-in membership lookup, and organisation creation. Tests: `packages/db/test/narrow-privileges.test.ts`, `apps/web/server/users/__tests__/runtimeLogin.pg.test.ts`.
  - In the code: every tenant query runs through `withOrg`, which switches to `buxa_app`. Request handling does not use the migration login.
  - **Not enforced by the database yet:** the login the server connects with is whatever `DATABASE_URL` names. Until the operator creates a separate runtime login with no bypass (`docs/deploy.md`, "Database requirements"), that login is the migration login, which can bypass row-level security for any query that does not go through `withOrg`. Until that step is done, the statements above describe the code, not the live connection.
  - Erasure needs a separate, reviewed process.
- **Audit log:** every write to people, memberships, badges and attendance is recorded in the same transaction. The log cannot be updated, deleted or truncated by the app role.
- **Authentication:** tokens are verified against Supabase's public keys (ES256 or RS256 only). `none` and shared-secret tokens are rejected. Users are matched by provider id, not email. See `docs/auth.md`.
- **Authorisation:** a permission matrix in `packages/domain` decides every action, server-side. The UI hides controls for convenience only; the server enforces the same rules.
- **Badges:** 128 random bits from a secure random source, shown once, stored only as a hash. Reissuing revokes the old badge.
- **Web headers:** a per-request Content-Security-Policy with a fresh nonce, plus standard security headers.
- **Inputs:** validated with zod at the boundary; exports neutralise spreadsheet formulas.
- **Pages:** camp pages require a session, and each action checks the actor's role.
- **Rate limits:** fixed windows counted in Postgres (`rate_limits`, migration 0010), so every serverless instance shares them. Each limit is keyed by a hash of the rule and the identity, so no address or user id is stored in the clear. A limited request gets a 429 with `Retry-After` (the server action shows the message in the form). The limits, all in `apps/web/server/rateLimit/limiter.ts`:
  - **Starting a camp** (`POST /v1/orgs` and the camp form): 10 per hour per person. Both paths share the budget. Chosen to allow a camp operator to set up several camps, while stopping a loop of slug and row creation.
  - **Badge scans** (scanner server action): 120 per minute per signed-in person, which allows about one scan every half second. A busy gate scans a person every few seconds, so staff should not reach it in normal use. It bounds scan volume if a session is abused.
  - **Readiness probe** (`GET /ready`): the database check is cached for 5 seconds per instance, so most calls run no query at all. The cache is per instance, and the rate limit of 30 checks per minute per client address applies only when the cache has expired. The client address is the last `X-Forwarded-For` hop, which the platform appends.
  - If the limiter cannot be reached, the probe still answers, and the database check decides.
- **Request bodies:** capped at 1 MB by counting bytes as they are read. A request without a Content-Length is cut off at the same point.
- **Input format:** email and phone are checked for shape in `packages/contracts` (`contact.ts`). A value the database refuses (check constraint, too long, wrong type) is a 400 with a generic message, never a 500 and never the database's own text.
- **Static files:** `_next/static`, `_next/image` and `icon.svg` send `X-Content-Type-Options: nosniff` (from `next.config.ts`, because `proxy.ts` skips them).
- **Local dev server** (`npm run server`, not part of the deployed app): it listens on loopback only unless `BUXA_ALLOW_REMOTE_HOST=yes` is set. Every `/api` request must send the run secret in `X-Buxa-Run-Secret`. The server prints a new secret each run, or uses `BUXA_LEGACY_SECRET` (at least 16 characters) if set. The browser reads the same value from `NEXT_PUBLIC_LEGACY_SECRET`. The event stream takes it as a `run_secret` query parameter, because the browser's EventSource cannot send headers.

## 3. Planned, not built

- **Access logging for people records:** who viewed which child's record, and when. Needed before real data.
- **Rate limiting** on the other API endpoints. Camp creation, scanning and the readiness probe are limited (section 2). Supabase limits sign-in attempts.
- **Two-factor sign-in for admins and staff.**
- **Field-level encryption** for sensitive fields such as medical notes (phase 6 or later; medical data is out of scope for now).
- **Error and security monitoring** with a service that alerts on repeated failures.
- **Backups:** automated daily, with point-in-time recovery on a paid plan, and a restore test before launch (see `docs/deploy.md`).
- **Separate environments:** real data only in its own Supabase project and Vercel environment; previews never connect to it.

## 4. Children's data

- Collect only what each phase needs. Phase 1 holds names, date of birth, household links and attendance. It does not hold medical notes, photos or home addresses.
- Consent and notices: a parent or guardian must be told what is stored and why. The consent flow is not built.
- US rules: COPPA and state child-privacy laws apply. A lawyer's review is required before real data is stored.
- Retention: each record type needs a set period and a deletion process. None is defined yet.
- Access by viewers: viewers see names and roles only. Minor status and contact details are hidden from them.

## 5. Reporting a problem

Report suspected security issues privately to the repository owner. Do not open a public issue. Include the steps to reproduce and what data could be exposed. We aim to acknowledge within two working days.

## 6. Open items before real data (must all be done)

- [ ] Privacy review of children's data (COPPA, state rules), with consent and notice text
- [ ] Retention periods and a deletion process for each record type
- [ ] Access logging for people and attendance records
- [ ] Rate limits on API and scanner endpoints (camp creation, scanning and `/ready` are done; see section 2)
- [ ] Two-factor sign-in for staff and admins
- [ ] Automated backups with a tested restore
- [ ] Separate production Supabase project and Vercel environment
- [ ] Error and security monitoring with alerts
- [ ] External penetration test
- [ ] Secrets review: no keys in the repository or build logs; rotation plan
