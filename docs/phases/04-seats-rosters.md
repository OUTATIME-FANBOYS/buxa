# Phase 4: seats, groups and rosters

Status: **spec for review. No code yet.** Roadmap row: "Seats & rosters: groups, cabins, rooms, assign people, per-session check-in."
Depends on: phases 2 and 3.

## Moved from phase 3: seat holds and the waitlist

Built on branch `v0.3/feat/seat-holds`: holds reserve a place for a household for 15 minutes (`SEAT_HOLD_MINUTES`); capacity holds under concurrency through the database (migration 0025); a freed place goes to the first waitlisted enrolment, and each promotion is audited.

Built on branch `v0.3/feat/registration-holds` (migration 0043): the scheduled job `GET /api/cron/release-expired-holds` releases expired holds in every camp and promotes waitlists, guarded by `CRON_SECRET` (see `docs/deploy.md`). The `completed` release reason is in the table.

Not built yet:

- Taking a hold from the registration submission. Blocked on which row a family registers for: registrations name sessions (no capacity), and seats are on classes (see `docs/phases/03-registration.md`).
- Turning a hold into an enrolment when the family completes registration.
- The waitlist UI, and a screen that shows holds.
- Hold length set per camp (fixed at 15 minutes for now).

## Words we use

- **Group**: a set of campers who share a unit for a session, such as a cabin, a tent, a team or a pod. Each group has a capacity.
- **Room**: a physical space (cabin, lodge, field, lab) with a capacity and a location.
- **Assignment**: a camper placed in a group and a room for one session. A camper has at most one active assignment per session.
- **Ratio**: the required number of staff per camper in a group, for example 1:8 for ages 6 to 8. Ratios are stored, and this phase enforces them.
- **Roster**: the list of campers and staff in a session, grouped by group and room.
- **Per-session check-in**: check-in that records which session a camper attends, not only the camp day. Replaces the camp-day check-in for sessions that use rosters.

## Decisions

1. **One assignment per camper per session.** Enforced in the database, not only in the UI.
2. **Ratios are enforced when assigning.** An assignment that breaks a group's staff ratio is refused unless an admin overrides it with a reason.
3. **Gender and age mixing rules** are not built in this phase. Camps can record a group's age range; age checks reuse phase 2's age rules.
4. **Room double-booking is refused** for overlapping sessions, using the same overlap rule as phase 2.
5. **Rosters are read-only exports** for printing and sharing with staff; editing happens in the app.

## Acceptance criteria

- Staff can create groups and rooms for a session, with capacities and, for groups, a staff ratio.
- Staff can assign and move campers and staff; each move is refused with a clear reason when it breaks capacity, ratio, age range or room overlap.
- A roster can be exported (CSV and printable page) for a session, grouped by group and room.
- Per-session check-in records the session, and a camper not assigned to that session is flagged.
- Every assignment change is in the audit log.

## Exit tests (must pass in CI before the phase is done)

- Ratio: a group at its limit refuses a camper; an admin override is recorded with its reason.
- Room overlap: two sessions that overlap cannot both book the same room; sessions that touch can.
- Database: a camper cannot hold two active assignments in one session (constraint test).
- Concurrency: two parallel moves into the last place in a group produce one success.
- Export: a roster export never includes data a viewer may not see; formula neutralisation applies to CSV.

## Not in this phase

Automatic group creation or auto-assignment (phase 5), transport, meal plans, medical grouping.

## Open for review

- Whether ratio rules differ by session type (day camp, overnight).
- Whether a camper's group carries over between sessions by default.
