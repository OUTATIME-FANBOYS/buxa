# Phase 3: registration

Status: **spec for review. No code yet.** Roadmap row: "Registration: sign-up forms with custom fields, holds, waitlist. No card payments yet (demo only)." Card payments and refunds moved to phase 9 (`09-payments-go-live.md`).
Depends on: phase 2 (sessions and enrolments).

## Moved from phase 2: recurring events, public class pages and the iCal feed

These were in the phase 2 roadmap row and moved here so that phase 2 closes on classes, sessions and enrolment alone.

- **Recurring sessions:** a weekly rule expands into normal sessions, each with its own enrolments. Overlap and capacity still apply to each. Tests cover month ends, DST days, and the count and until limits.
- **Public class pages:** a read-only page per class, listing its upcoming sessions, with no contact details and no enrolled campers. Only classes marked public.
- **iCal feed:** a read-only feed per camp that calendar apps subscribe to by URL, authenticated by an unguessable token stored as a hash. Archived camps return not found.

**Built, not merged:** branch `v0.2/feat/recurring-ical-public`, three parts, migrations 0020 and 0021.

**Open decisions:**

- Staff UI to create a series and to make an existing class public. The branch has the server side only.
- Token rotation from Settings. Settings is still being reworked, so the button waits for that.
- The token is in the feed URL's query string. Calendar apps cannot send headers, so the token has to be in the URL. The remaining risk is platform request logs; check their retention.

## Words we use

- **Registration**: a family's request to enrol a camper in one or more sessions, with the form answers and a payment.
- **Registration form**: a camp's form for a season, with standard fields (camper, guardian, emergency contact) and custom fields the camp defines. Custom fields are typed (text, choice, date, yes/no) and validated by schema.
- **Hold**: a short reservation of a session place while a family completes payment. A hold expires after a set time (proposed: 15 minutes) and returns the place.
- **Waitlist**: an ordered queue for a full session. A place released by a cancellation goes to the first waitlisted registration.
- **Price**: an amount shown for a session, with an optional early-bird date. Shown for information only in this phase; nothing is charged.

## Decisions

1. **No money in this phase.** Registrations are demo-only and no card is charged. Payments follow in phase 9.
2. **Holds, not overselling.** Taking a place is done in a database transaction that locks the session row. A hold expires on its own; a background job releases expired holds.
3. **Confirmation** is a staff action in this phase, recorded in the audit log, until payments arrive in phase 9.
4. **Custom fields are versioned.** A change to a form does not change answers already given; each answer stores the form version.
5. **Prices are stored in the smallest currency unit** with the currency code, for display only.

## Acceptance criteria

- A camp admin can create a registration form for a season, add custom fields, and publish it.
- A family can register a camper for one or more sessions and see a confirmation (no payment in this phase).
- A full session takes a waitlist entry; when a place frees, the first waitlisted registration is offered it.
- An unpaid hold returns its place after the expiry time.
- Every registration, confirmation and price change is in the audit log.

## Exit tests (must pass in CI before the phase is done)

- Concurrency: two registrations for the last place, in parallel, produce exactly one confirmed registration and one waitlist entry.
- Concurrency: a hold and a new registration racing for the same place never both succeed.
- Privacy: registration answers are never returned to viewers beyond their role.

## Not in this phase

Card payments, refunds, Stripe Connect, instalments, sponsorship funds (all phase 9). Multi-currency.

## Permissions by category

Every action in `packages/domain/src/permissions.ts` sits in one category below. This phase does not change the matrix; the section only groups it so each area can be checked on its own. The default roles are the matrix's: owner has everything admin has, admin has everything staff has, and so on. "Built" means the code that uses the action exists today (phases 0 to 2 and the staff board). "Future" means the feature has not been built yet.

| Category                               | Permissions in it                                                                                                                                              | Default roles                                                                                                                                                                       | Status                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Operations (check-in and on-site)      | `attendance:read`, `attendance:record`, `attendance:override`, `attendance:export`                                                                             | Staff: read and record. Admin and owner: also override and export. Viewer: none.                                                                                                    | Built (phase 1 check-in)                                                                                                               |
| People (people and households)         | `people:read`, `people:read_contact`, `people:create`, `people:update`, `people:delete`, `people:authorise_pickup`, `memberships:manage`, `credentials:manage` | Viewer: read. Staff: read contacts, create and update. Admin and owner: delete, pickup authority, memberships and check-in credentials.                                             | Built (phase 1)                                                                                                                        |
| Classes and events                     | `classes:manage`, `events:read`, `events:create`, `events:update`, `events:delete`                                                                             | Viewer: read events. Staff: manage classes. Admin and owner: create, update and delete events.                                                                                      | Built (phase 2)                                                                                                                        |
| Money (payments and refunds)           | None yet                                                                                                                                                       | Decided in phase 9                                                                                                                                                                  | Future (phase 9)                                                                                                                       |
| Registration                           | None yet. Confirming a registration is a staff action (decision 3), so this phase adds at least one action.                                                    | To be set when the action is added                                                                                                                                                  | Future (this phase)                                                                                                                    |
| Team (members and roles)               | `members:read`, `members:leave`, `members:read_contact`, `members:invite`, `members:change_role`, `members:remove`                                             | Viewer: read members and leave. Admin and owner: read contacts, invite, change roles and remove members.                                                                            | Partly built: the list is built; invite, role change and removal are planned (the Team access page says invites are not yet available) |
| Work (boards, projects and tasks)      | `tasks:read`, `tasks:create`, `tasks:update`, `tasks:move`, `tasks:comment`, `tasks:delete`, `tasks:manage_board`                                              | Viewer: read. Staff: create, edit, move and comment. Admin and owner: delete and manage boards.                                                                                     | Built (staff board)                                                                                                                    |
| Admin (camp settings, delete and data) | `org:read`, `org:update`, `audit:read`, `org:delete`, `org:transfer_ownership`, `data:export`, `data:erase`                                                    | Viewer: read the camp. Admin and owner: rename the camp and read the audit log. Owner only: delete the camp, transfer ownership, export and erase data. There is no archive action. | Partly built: renaming the camp is built; the audit log, delete, transfer, export and erase are planned                                |

### Teacher role (planned in this phase)

The camp roles stay owner, admin, staff and viewer, plus one planned role: **teacher**. It is for the adults who run a class, and it is added in this phase. Its token (`--role-teacher`) already exists; its screens and permission rules do not.

A teacher gets only what it needs to run its own classes:

- `attendance:read` and `attendance:record`, limited to the sessions of the classes the teacher is assigned to.
- `events:read` and the people in those classes, so it can look up and check in campers. Read-only, limited to the same classes.
- No contact details, no edits to people or classes, no team or admin rights, no money rights.

The scoping rule ("assigned classes only") is not in the matrix yet. It is added with the teacher role in this phase, as a change to the matrix that is reviewed on its own.

## Open for review

- Hold length (proposed 15 minutes) and whether camps can change it.
- Whether a deposit or balance-later option is wanted once payments arrive (phase 9).
