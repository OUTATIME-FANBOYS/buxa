# Phase 3: registration

Status: **in progress.** Sign-up forms are built on branch `v0.3/feat/registration-forms`. Prices are built on branch `v0.3/feat/session-prices` (see the Prices section). Seat holds are built on branch `v0.3/feat/seat-holds`. Holds and the waitlist UI, and price display, moved to phases 4 and 6 (see below). Roadmap row: "Registration: sign-up forms with custom fields, confirmation. No card payments yet (demo only)." Card payments and refunds moved to phase 9 (`09-payments-go-live.md`).
Depends on: phase 2 (sessions and enrolments).

## What is built (sign-up forms)

- **Forms per season.** A staff admin creates a form with a name, a season, the sessions it covers (one or more sessions of the camp) and its own questions. The questions are typed: text, choice (two or more options), date, or yes or no. A form is a draft until it is published.
- **Publishing freezes a version.** Publish writes the draft as the next numbered version. Later edits to the draft do not change it; each registration stores the version it was answered against.
- **Standard questions** are asked on every form: the camper (first name, last name, date of birth), the parent or guardian (name, email optional, phone), and an emergency contact (name, phone).
- **Taking a registration.** Staff with `registration:submit` record a registration for one or more of the form's sessions, on the published version. It is recorded as **pending**. The server checks the answers against that version with zod (the browser is not trusted) and checks the sessions against the form's session set. Nothing is charged.
- **Confirmation.** Staff with `registration:confirm` confirm a pending registration from its form's page (Confirm, on each pending row). Confirming sets it to confirmed, with the time and the user, and writes `registration.confirm` in the same transaction. A registration that is already confirmed is refused, so a second confirmation writes nothing. Viewers cannot confirm. There is no un-confirm in this phase.
- **Submissions by session.** The form page lists the registrations for each session, with the answers behind a disclosure.
- **Audit.** `registration_form.create`, `registration_form.update`, `registration_form.publish`, `registration.submit` (a recorded, pending registration) and `registration.confirm` are written in the same transaction as the change.
- **Storage.** Migration `0023_registration_forms.sql`: `registration_forms` (draft), `registration_form_sessions` (the session set), `registration_form_versions` (frozen definitions), `registrations` and `registration_sessions`. Every table has `org_id`, forced row-level security and one policy. The request role has no DELETE; the session set is replaced by `buxa_replace_form_sessions`.
- **Screens.** `/camp/registration` (the forms), `/camp/registration/new`, `/camp/registration/[formId]` (edit draft, publish, registrations by session) and `/camp/registration/[formId]/register` (take a registration). The sidebar item is under Operations and needs `registration:read`.

**Deviation from the acceptance criteria:** a family does not register by itself yet. A signed-in staff member records it on the family's behalf. A family-facing link needs an anonymous or parent-account entry point, which belongs to the parent portal (phase 6).

**Not built, and the seam for it:**

- Holds and the waitlist moved to phase 4 (Seats & rosters). See `04-seats-rosters.md`, "Moved from phase 3".
- Price display on the registration moved to phase 6 (Comms & extras). See `06-comms-extras.md`, "Moved from phase 3". Prices are stored and shown on the session and class screens.

## Moved from phase 2: recurring events, public class pages and the iCal feed

These were in the phase 2 roadmap row and moved here so that phase 2 closes on classes, sessions and enrolment alone.

- **Recurring sessions:** a weekly rule expands into normal sessions, each with its own enrolments. Overlap and capacity still apply to each. Tests cover month ends, DST days, and the count and until limits.
- **Public class pages:** a read-only page per class, listing its upcoming sessions, with no contact details and no enrolled campers. Only classes marked public.
- **iCal feed:** a read-only feed per camp that calendar apps subscribe to by URL, authenticated by an unguessable token stored as a hash. Archived camps return not found.

**Built, not merged:** branch `v0.3/feat/recurring-ical-public`, on top of `Phase3`. Server, domain and database are in; migrations 0028 (calendar token) and 0029 (public sessions). The earlier branch used 0020 and 0021, which clash with shipped migrations. Renumbered to 0028 and 0029 for the merge order (Registration 0023, prices 0024, holds 0025, teacher role 0026 and 0027 come first).

Terms on this branch: a **session** (the parent row) is the public page's unit, and its **classes** are the time ranges a series generates. A public page lists a session's upcoming classes.

**Open decisions:**

- Staff UI to create a series and to make a session public. Not built on this branch: the server methods exist (`addRecurringClasses`, `setSessionPublic`), but there is no screen yet.
- Token rotation from Settings. Not built: `CalendarService.rotateToken` exists, but no screen calls it, so no camp can get a feed token yet.
- The token is in the feed URL's query string. Calendar apps cannot send headers, so the token has to be in the URL. The remaining risk is platform request logs; check their retention.

## Prices (built, branch `v0.3/feat/session-prices`)

- A price belongs to a **session** (the parent row in `classes`), so every class in it shows the same price. Stored as integer minor units with an ISO 4217 code, plus an optional early-bird amount and its last day (migration `0024_session_prices.sql`). Nothing is charged.
- **Early-bird rule:** the early-bird amount is shown while today, as a calendar day in the camp's time zone, is on or before the early-bird last day. From the next day, the regular price is shown. Tested in `packages/domain/test/session-prices.test.ts` (boundary day, 23:30 in the camp zone, and the day after).
- **Rounding:** amounts are integers, and typed input is never rounded. Extra decimal places are refused (`parseMoney`). Formatting uses integer arithmetic only.
- **Who:** staff and above (`classes:manage`). A viewer is refused by the service and the server action. The permission matrix is unchanged.
- **Audit:** every change writes `session.price_change` with the previous and new price (minor units). An unchanged price writes nothing. Session creation with a price writes one entry.
- **Screens:** the New session form takes a price; the session page has a Set/Change price dialog; the session and selected-class details show the price for today.
- **Not yet:** the class form does not set the price (the price is per session). Multi-currency conversion is out of scope.

## Status: seat holds

**Built (branch `v0.3/feat/seat-holds`):**

- A hold reserves one place in a class for a household. One active hold per household per class. It counts as taken only while it is unreleased and its time has not passed, so an expired hold returns its place at once, without a job.
- The length is one constant, `SEAT_HOLD_MINUTES` (15) in `packages/domain/src/classes/holds.ts`.
- Capacity holds under concurrency: the hold and enrolment triggers (migration 0025) lock the class row and count enrolments plus live holds. Tested on real Postgres with parallel holds and holds racing enrolments for the last place.
- A place freed by a cancelled hold, an expired hold or a cancelled enrolment goes to the first waitlisted enrolment, in the order they joined. Each promotion is audited (`enrolment.promote`). Waitlist promotion was not in phase 2.
- The cleanup (`releaseExpiredHolds(orgId)`) releases expired holds and promotes waitlists. It is safe to run twice. Enrolling a camper and placing a hold first free the class's expired holds, so the waitlist is never skipped.
- Permission `holds:manage` (staff, admin, owner; not viewer). Archived camps are read-only, as for every write.
- Row-level security and a camp-isolation test on `seat_holds`.

**Not built yet:**

- Taking a hold from the registration submission. The service method is ready for it (`SeatHoldService.placeHold`, `releaseHold`); the form's submit path does not call it yet.
- Turning a hold into an enrolment when the family completes registration. The `completed` release reason is not in the table yet; the form adds it with that change.
- The waitlist UI, and a screen that shows holds.
- A scheduled job for `releaseExpiredHolds`. Expired holds already stop counting without it.
- Hold length set per camp. It is fixed at 15 minutes (see Open for review).

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

Every action in `packages/domain/src/permissions.ts` sits in one category below. This phase does not change the matrix; the section only groups it so each area can be checked on its own.

**Status: grouping built** (`packages/domain/src/permissionCategories.ts`, tests in `packages/domain/test/permissionCategories.test.ts`, read-only table on the Team page). No role's grants changed. Three places where the code differs from the table below, to resolve before the phase closes:

- `members:rename` (rename a member) is in the code but not in the Team row. It is grouped under Team.
- `org:archive` and `org:unarchive` are in the code (owner only), but the Admin row says there is no archive action. They are grouped under Admin. The default roles are the matrix's: owner has everything admin has, admin has everything staff has, and so on. "Built" means the code that uses the action exists today (phases 0 to 2 and the staff board). "Future" means the feature has not been built yet.

| Category                               | Permissions in it                                                                                                                                              | Default roles                                                                                                                                                                                          | Status                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Operations (check-in and on-site)      | `attendance:read`, `attendance:record`, `attendance:override`, `attendance:export`                                                                             | Staff: read and record. Admin and owner: also override and export. Viewer: none.                                                                                                                       | Built (phase 1 check-in)                                                                                                               |
| People (people and households)         | `people:read`, `people:read_contact`, `people:create`, `people:update`, `people:delete`, `people:authorise_pickup`, `memberships:manage`, `credentials:manage` | Viewer: read. Staff: read contacts, create and update. Admin and owner: delete, pickup authority, memberships and check-in credentials.                                                                | Built (phase 1)                                                                                                                        |
| Classes and events                     | `classes:manage`, `events:read`, `events:create`, `events:update`, `events:update_details`, `events:delete`                                                    | Viewer: read events. Staff: manage classes. Admin and owner: create, update and delete events, and change any field of a class. Teacher: change the name of its own classes (`events:update_details`). | Built (phase 2)                                                                                                                        |
| Money (payments and refunds)           | None yet                                                                                                                                                       | Decided in phase 9                                                                                                                                                                                     | Future (phase 9)                                                                                                                       |
| Registration                           | `registration:read`, `registration:submit`, `registration:manage`, `holds:manage`                                                                              | Viewer: none. Staff: read forms and submissions, record a registration, place and release holds. Admin and owner: also create, edit and publish forms. Owner has everything admin has.                 | Built (this phase): forms, publishing and submissions. Holds are built. The waitlist UI and confirmation are not built                 |
| Team (members and roles)               | `members:read`, `members:leave`, `members:read_contact`, `members:invite`, `members:change_role`, `members:set_options`, `members:remove`                      | Viewer: read members and leave. Admin and owner: read contacts, invite, change roles and remove members, and turn a teacher's options on or off (`members:set_options`).                               | Partly built: the list is built; invite, role change and removal are planned (the Team access page says invites are not yet available) |
| Work (boards, projects and tasks)      | `tasks:read`, `tasks:create`, `tasks:update`, `tasks:move`, `tasks:comment`, `tasks:delete`, `tasks:manage_board`                                              | Viewer: read. Staff: create, edit, move and comment. Admin and owner: delete and manage boards.                                                                                                        | Built (staff board)                                                                                                                    |
| Admin (camp settings, delete and data) | `org:read`, `org:update`, `audit:read`, `org:delete`, `org:transfer_ownership`, `data:export`, `data:erase`                                                    | Viewer: read the camp. Admin and owner: rename the camp and read the audit log. Owner only: delete the camp, transfer ownership, export and erase data. There is no archive action.                    | Partly built: renaming the camp is built; the audit log, delete, transfer, export and erase are planned                                |

### Teacher role

The camp roles are owner, admin, staff, viewer and teacher. A teacher is for the adults who run a class. Its default grants:

- `attendance:read`, limited to the sessions of the classes the teacher is assigned to.
- `events:read` and the people in those classes, so it can look up campers. Read-only, limited to the same classes.
- `events:update_details`: change the name of its own classes. A teacher may not change a class's camp size, ages, times, location, price or instructors (the server refuses the change with `teacher_field_refused`). Staff, admin and owner keep `events:update` for every field.
- No contact details, no edits to people or classes beyond the name, no team or admin rights, no money rights.

**Per-person options.** An admin (or owner) turns these on for one teacher on the Team page. Each option is off by default and grants only the one action it names, only to a teacher, and only inside its assigned classes. The options are listed in `MEMBER_OPTIONS` (`packages/domain/src/permissions.ts`) and stored in `member_options` (migration 0030).

- `teacher.check_in_out`: check campers in and out (`attendance:record`) in its assigned classes. Off by default; without it a teacher is refused check-in and check-out.

`authorize()` is the one decision point. The option is read into the actor for the request (`withMemberOptions`), and the assigned-classes scope is applied on top of it.

**Status (issue #258, branch `v0.3/feat/teacher-role`; options on branch `v0.3/feat/permission-categories`):** built. The role is in migration 0026; assignments are `class_teachers` (migration 0027), set by staff and admins with `classes:manage`. The scope is `ASSIGNED_CLASSES_ONLY` in `packages/domain/src/permissions.ts`. The options are migration 0030, the `members:set_options` action (admin and owner, a teacher target only), and the check-in switch in the Team table. Still to do: a browser check of the Team switch and the teacher's class form (name only), and the teacher sidebar and the orange role pill.

## Open for review

- Hold length (proposed 15 minutes) and whether camps can change it.
- Whether a deposit or balance-later option is wanted once payments arrive (phase 9).
