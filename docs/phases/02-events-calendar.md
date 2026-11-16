# Phase 2: classes, sessions and enrolment

Status: **spec for review. No code yet** (no enrolment or class code is on `develop`). Roadmap row (phase 2, `docs/ROADMAP.md`): "Events & calendar: programs to sessions, recurring events, capacity, public pages, iCal feed."
This spec covers the first slice of that row: classes (the roadmap's "programs") and their sessions, and who is enrolled. Recurring events, public pages and the iCal feed are still phase 2 work and come after this slice. Phase 2 is not done until its roadmap exit criteria pass, including the recurrence and public-page tests.

## Words we use

- **Class**: an activity the camp offers, for example Robotics, Painting or 3D Printing. A class belongs to the camp and can run across several sessions. It holds the description, the age range and the default capacity.
- **Session**: one scheduled run of a class, for example "Robotics, Monday 9:00-12:00, week 1". A session has a start and end, a location, its own instructors, its own capacity and its own enrolments. The session is the unit that is scheduled and enrolled in.
- **Enrolment**: one camper in one session, with a status (enrolled, waitlisted, cancelled). A camper may hold several enrolments, but never two that overlap in time.
- **Instructor ratio**: the number of campers allowed per instructor in a session, for example 1:8. Stored and shown now; not enforced automatically yet.
- **Age range**: minimum and maximum age for a class. Checked when a camper is enrolled.

## Decisions

1. A class can run across several sessions. Sessions are the unit that is scheduled and enrolled in.
2. Overlapping enrolments are blocked by default, across all classes in the camp, not only within one class. An admin may override with a reason, recorded in the audit log.
3. Age limits are enforced at enrolment. Instructor ratios are stored and configurable; automatic enforcement is deferred.
4. A session's capacity is a hard limit: no more enrolments than capacity, even when two people enrol at the same moment.

## Acceptance criteria

- Staff can create a class with a name, description, age range and default capacity.
- Staff can add sessions to a class with a start, end, location, instructors and capacity.
- Enrolling a camper into a session fails with a clear reason when: the camper is outside the age range; the session is full; the camper has an overlapping enrolment (unless overridden by an admin with a reason).
- Cancelling an enrolment frees its place and its time.
- Every change is written to the audit log in the same transaction.
- Viewers see classes and sessions but not the contact details of enrolled campers.

## Exit tests (must pass in CI before the phase is done)

- Domain: overlap detection for sessions that touch, nest or cross midnight; age range boundaries inclusive; capacity limit.
- Domain: an admin override is allowed only with a reason and is recorded.
- Database: two concurrent enrolments into the last place result in exactly one success (concurrency test).
- Database: row-level security keeps one camp's classes and enrolments invisible to another camp.
- UI: a full session shows a waitlist option instead of enrolling; a blocked overlap explains which other session it clashes with.

## Not in this phase

Public class pages, iCal feed, payments, waitlist promotion, automatic ratio enforcement, and check-in per session (check-in stays per camp day for now).

## Open for review

- Whether a camper can be waitlisted automatically, or staff add them by hand.
- Whether check-in per session is needed in phase 2 or phase 4 (seats and rosters).
