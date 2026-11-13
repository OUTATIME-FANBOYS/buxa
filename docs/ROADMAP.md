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
| 1 | Members & check-in | People & households, memberships (valid/expired), QR + name lookup, attendance log | Staff check in a member in under 5 seconds on a phone; attendance export |
| 2 | Events & calendar | Programs → sessions, recurring events, capacity, public pages, iCal feed | Recurrence rules tested incl. DST; public page works without login |
| 3 | Registration & payments | Sign-up forms with custom fields, Stripe Connect, waitlist, refunds | Concurrent sign-ups never exceed capacity; payments reconcile with Stripe |
| 4 | Seats & rosters | Groups, cabins, rooms, assign people, per-session check-in | Ratio rules enforced; assignments conflict-checked |
| 5 | Scheduling | Conflict detection first, auto-schedule later | Conflicts for staff, rooms and gear reported with zero false negatives in tests |
| 6 | Comms & extras | Reminders, waivers, parent portal, reports | Waiver stored with timestamp and version; reminders idempotent |
| ops | Staff board (existing kanban) | Move onto the new backend, scoped per org | Existing 60 tests ported or replaced |

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
