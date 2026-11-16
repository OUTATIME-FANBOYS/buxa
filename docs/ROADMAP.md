# Buxa roadmap: camp management

Buxa is a camp and membership platform. The kanban board stays as the **staff operations module**
(prep and day-of tasks). Agent approvals are parked until the camp core works.

Build order follows the product roadmap: **members & check-in → events & calendar → registration &
payments → seats & rosters → scheduling → comms & extras.** Scheduling is the hardest part, so it goes last.

## How every phase works

1. **Spec first.** Write the phase's glossary terms and acceptance criteria in `docs/phases/NN-name.md` before code.
2. **Tests before behaviour** for domain rules (tdd). A phase is not started until its exit tests are listed.
3. **Small PRs** off `main`, squash-merged, each one passing CI. Conventional commit titles (`feat:`, `fix:`, `docs:`, `chore:`).
4. **Exit gate.** A phase is done only when its exit criteria pass in CI *and* a person has used it end to end.
5. **Tag a release** at each phase end (`v0.N.0`) so progress is visible on GitHub.

## Phases

| # | Phase | Deliverable | Exit criteria |
|---|---|---|---|
| 0 | Foundation | Monorepo, Postgres, migrations, managed auth, orgs (tenants), roles, audit log, CI | Two orgs cannot see each other's rows (tested); CI green; deploy to a staging URL |
| 1 | Members & check-in (spec: `docs/phases/01-members-checkin.md`) | People & households, memberships (valid/expired), QR + name lookup, attendance log, staff mobile app (installable web app, see below) | Staff check in a member in under 5 seconds on a phone (iOS Safari and Android Chrome); attendance export; staff can install the app and sign in from a phone |
| 2 | Events & calendar (spec: `docs/phases/02-events-calendar.md`) | Classes, sessions, enrolments, age rules, overlap blocking, capacity, calendar | Recurrence and overlap rules tested incl. DST; enrolment never exceeds capacity under concurrency |
| 3 | Registration (spec: `docs/phases/03-registration.md`) | Sign-up forms with custom fields, holds, waitlist. No card payments yet (demo only) | Concurrent sign-ups never exceed capacity; holds expire and return places |
| 4 | Seats & rosters (spec: `docs/phases/04-seats-rosters.md`) | Groups, cabins, rooms, assign people, per-session check-in | Ratio rules enforced; assignments conflict-checked |
| 5 | Scheduling (spec: `docs/phases/05-scheduling.md`) | Conflict detection for staff, rooms and equipment; auto-schedule later | Conflicts reported with zero false negatives in tests |
| 6 | Comms & extras (spec: `docs/phases/06-comms-extras.md`) | Reminders, waivers, parent and instructor portals, reports | Waiver stored with timestamp and version; reminders idempotent; guardians see only their own children |
| 7 | Staff board (spec: `docs/phases/07-staff-board.md`) | Tasks and projects on the database, scoped per camp | Existing 60 tests ported or replaced; tenant isolation tested |
| 8 | Payments & go-live (spec: `docs/phases/08-payments-go-live.md`) | Stripe Connect payments, refunds, and every security item needed for real children's data | Privacy review signed off; payments reconcile with Stripe; external penetration test passed; restore from backup tested |

**Real data rule:** until phase 8 is done, the app runs on mock and demo data only. No family or child's real information is stored, and no card is charged.

## Staff mobile app

Staff use a phone at the check-in desk, so phase 1 includes a mobile app. Decision: start with an installable web app
(PWA) built into the existing site, not a native app. One codebase, no app-store review, and the camera scanner
works in the browser. A native app is revisited only if the PWA cannot meet the 5-second check-in target on real
phones. Mobile check-in needs a connection; offline check-in is out of scope (see `docs/phases/01-members-checkin.md`).

## Decisions that must be made early (from the roadmap)

- Multi-tenant from day one: `org_id` on every row, Postgres row-level security.
- Generic events with custom fields per org (typed JSON validated by schema).
- Never hold money: Stripe Connect only.
- Kids' data: consent, medical notes, minimal retention, encryption at rest, access logging. US privacy rules for minors (COPPA, state laws) to be reviewed before real data.
- No overselling: expiring seat holds and database transactions, covered by a concurrency test.
- Camp licensing rules: ratios, background checks, pickup authorization are modelled, not free text.
- WCAG 2.2 AA from the start.
- Talk to 5 to 10 camp directors before phase 2. Your own org is customer zero.

## Not doing yet

Auto-scheduling, SSO, native apps, non-US payments, agent approvals inside the camp flows.
