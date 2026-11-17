# Buxa roadmap: camp management

Buxa is a camp and membership platform. The kanban board stays as the **staff operations module**
(prep and day-of tasks). Agent approvals are parked until the camp core works.

Build order follows the product roadmap: **members & check-in → events & calendar → registration &
payments → seats & rosters → scheduling → comms & extras.** Scheduling is the hardest part, so it goes last.

## How every phase works

1. **Spec first.** Write the phase's glossary terms and acceptance criteria in `docs/phases/NN-name.md` before code.
2. **Tests before behaviour** for domain rules (tdd). A phase is not started until its exit tests are listed.
3. **Small PRs** off `develop`, squash-merged into `develop`, each one passing CI. Conventional commit titles (`feat:`, `fix:`, `docs:`, `chore:`).
4. **Exit gate.** A phase is done only when its exit criteria pass in CI *and* a person has used it end to end.
5. **Tag a release** at each phase end (`v0.N.0`) so progress is visible on GitHub.

## Phases

| # | Phase | Deliverable | Exit criteria |
|---|---|---|---|
| 0 | Foundation | Monorepo, Postgres, migrations, managed auth, orgs (tenants), roles, audit log, CI | Two orgs cannot see each other's rows (tested); CI green; deploy to a staging URL |
| 1 | Members & check-in (spec: `docs/phases/01-members-checkin.md`) | People & households, memberships (valid/expired), QR + name lookup, attendance log, staff mobile app (installable web app, see below) | Staff check in a member in under 5 seconds on a phone (iOS Safari and Android Chrome); attendance export; staff can install the app and sign in from a phone. **Status:** released as v0.1.0 without the installable app. The app was reverted for v0.1.1 and re-landed on `develop` in #82; it is built. Still open: the owner's device timing and the signed-in walkthrough |
| 2 | Events & calendar (spec for classes and sessions: `docs/phases/02-events-calendar.md`) | Programs (called classes in the spec) → sessions, recurring events, capacity, public pages, iCal feed | Recurrence rules tested incl. DST; public page works without login. **Status:** built: classes, sessions, enrolment (age range, overlap with an audited admin override, capacity and waitlist), bulk CSV import with a preview before save, and the classes screens. Exit-test gaps for the domain and service rules are closed by tests. Still open: the owner's signed-in check at 390px and 1280px. The other Phase 2 items (recurrence, public pages, iCal) are being merged separately |
| 3 | Registration & payments | Sign-up forms with custom fields, Stripe Connect, waitlist, refunds | Concurrent sign-ups never exceed capacity; payments reconcile with Stripe |
| 4 | Seats & rosters | Groups, cabins, rooms, assign people, per-session check-in | Ratio rules enforced; assignments conflict-checked |
| 5 | Scheduling | Conflict detection first, auto-schedule later | Conflicts for staff, rooms and gear reported with zero false negatives in tests |
| 6 | Comms & extras | Reminders, waivers, parent portal, reports | Waiver stored with timestamp and version; reminders idempotent |
| ops | Staff board (existing kanban) | Move onto the new backend, scoped per org | Existing 60 tests ported or replaced |

## Staff mobile app

Staff use a phone at the check-in desk, so phase 1 includes a mobile app. Decision: start with an installable web app
(PWA) built into the existing site, not a native app. One codebase, no app-store review, and the camera scanner
works in the browser. A native app is revisited only if the PWA cannot meet the 5-second check-in target on real
phones. Mobile check-in needs a connection; offline check-in is out of scope (see `docs/phases/01-members-checkin.md`).

**Status:** on `develop` and built. The installable staff app was reverted for v0.1.1 and re-landed in #82; the build
serves a web app manifest (`/manifest.webmanifest`), and the install hint offers Android Chrome's install prompt.
Still open for phase 1: the owner's timing on real iOS and Android phones (`docs/phases/01-check-in-timing.md`) and
the signed-in walkthrough.

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
