# Phase 5: scheduling

Status: **spec for review. No code yet.** Roadmap row: "Scheduling: conflict detection first, auto-schedule later."
Depends on: phases 2, 3 and 4. Auto-scheduling is out of scope for this phase (roadmap: "not doing yet").

## Words we use

- **Resource**: anything scheduled that can clash: a staff member, a room, a piece of equipment (canoe, kiln, robot kit) or a vehicle.
- **Booking**: one use of a resource for a session or a time block.
- **Conflict**: two bookings of the same resource that overlap in time, or a booking that breaks a rule (a staff member's rest period, a room's opening hours).
- **Rule**: a constraint set by the camp (for example, a staff member may not work more than 10 hours a day, or a canoe may not be booked outside daylight).

## Decisions

1. **Conflict detection first.** This phase reports every clash before anything is automatic. Staff see conflicts and fix them.
2. **Zero false negatives** is the target: every real overlap is reported. A false positive (a reported clash that is not one) is acceptable and logged for review.
3. **Rules are data**, stored per camp and checked on every booking change, not hard-coded.
4. **Time zones**: bookings use the camp's time zone; daylight-saving changes are tested.

## Acceptance criteria

- Staff can book a resource for a session or time block; overlaps are shown immediately with the clashing booking named.
- A conflict report lists every clash for a date range, grouped by resource and by staff member.
- Camp rules (working hours, rest periods, opening hours) are set per camp and applied to every booking.
- A booking that breaks a rule is saved only with a reason, and the reason is recorded.

## Exit tests (must pass in CI before the phase is done)

- Overlap: sessions that touch, nest, cross midnight, or span a daylight-saving change are detected correctly (table-driven tests).
- Completeness: a generated set of random bookings is checked against a brute-force overlap checker; zero misses.
- Rules: each rule type has tests for the boundary value (exactly at the limit is allowed, one over is reported).
- Concurrency: two bookings of the same resource submitted together produce one saved booking and one reported conflict.

## Not in this phase

Automatic scheduling, optimisation of staff rotas, payroll, shift-swapping by staff.

## Open for review

- Who sets rules: owner only, or admins too.
- Whether equipment needs its own inventory model in this phase or a simple list.
