# Phase 3: registration

Status: **in progress.** Built on the v0.3 phase 3 branch (`v0.3/enhance/phase3-fixups`, migrations 0023 to 0041): sign-up forms and their versions, confirmation, session prices, seat-hold rules, the teacher role with its class assignments and per-person options, the camp and teacher calendar links, public session pages, and session edit and delete. Taking a hold on the registration, the waitlist UI and price display moved to phases 4 and 6 (see below). Public self-registration by a family is phase 6. Teacher invites by email are built (migration 0038); invites for other roles are not. Roadmap row: "Registration: sign-up forms with custom fields, confirmation. No card payments yet (demo only)." Card payments and refunds moved to phase 9 (`09-payments-go-live.md`).
Depends on: phase 2 (sessions and enrolments).

## What is built (sign-up forms)

- **Forms per season.** A staff admin creates a form with a name, a season, the sessions it covers (one or more sessions of the camp) and its own questions. The questions are typed: text, choice (two or more options), date, or yes or no. A form is a draft until it is published.
- **Publishing freezes a version.** Publish writes the draft as the next numbered version. Later edits to the draft do not change it; each registration stores the version it was answered against.
- **Standard questions** are asked on every form: the camper (first name, last name, date of birth), the parent or guardian (name, email optional, phone), and an emergency contact (name, phone).
- **Taking a registration.** Staff with `registration:submit` record a registration for one or more of the form's sessions, on the published version. One form can cover several sessions, and one family can enrol in several of them. Each registration is recorded under the sessions it covers (one row per session in `registration_sessions`). It is recorded as **pending**. The server checks the answers against that version with zod (the browser is not trusted) and checks the sessions against the form's session set. Nothing is charged.
- **Confirmation** is a separate staff action. Staff, admins and owners (`registration:confirm`) confirm a pending registration from its form's page (Confirm, on each pending row). Confirming sets it to confirmed, with the time and the user, and writes `registration.confirm` in the same transaction. A registration that is already confirmed is refused, so a second confirmation writes nothing. Viewers cannot confirm. There is no un-confirm in this phase.
- **Confirming does not enrol anyone.** A confirmed registration creates no enrolments. Staff add the camper in People, then enrol them in the class (the class page).
- **Confirming issues badges.** In the same transaction as the confirmation, each camper with no active badge gets one (`registration.confirm` and the badge rows commit together). Staff without `credentials:manage` confirm without badges, and are told an admin must issue them. If `BADGE_ENCRYPTION_KEY` is missing, the confirmation fails and rolls back, so the registration stays pending (`docs/deploy.md`).
- **Submissions by session.** The form page lists the registrations for each session, with the answers behind a disclosure.
- **Audit.** `registration_form.create`, `registration_form.update`, `registration_form.publish`, `registration.submit` (a recorded, pending registration) and `registration.confirm` are written in the same transaction as the change.
- **Storage.** Migration `0023_registration_forms.sql`: `registration_forms` (draft), `registration_form_sessions` (the session set), `registration_form_versions` (frozen definitions), `registrations` and `registration_sessions`. Every table has `org_id`, forced row-level security and one policy. The request role has no DELETE; the session set is replaced by `buxa_replace_form_sessions`.
- **Screens.** `/camp/registration` (the forms), `/camp/registration/new`, `/camp/registration/[formId]` (edit draft, publish, registrations by session) and `/camp/registration/[formId]/register` (take a registration). The sidebar item is under Operations and needs `registration:read`.

**Deviation from the acceptance criteria:** a family does not register by itself yet. A signed-in staff member records it on the family's behalf. A family-facing link needs an anonymous or parent-account entry point, which belongs to the parent portal (phase 6).

**Not built, and the seam for it:**

- Holds and the waitlist moved to phase 4 (Seats & rosters). See `04-seats-rosters.md`, "Moved from phase 3".
- Price display on the registration moved to phase 6 (Comms & extras). See `06-comms-extras.md`, "Moved from phase 3". Prices are stored and shown on the session and class screens.
- Public self-registration by a family is phase 6 (the parent portal). Registration is staff-only in this phase.

## Sessions, public pages and time zones

- **Edit and delete a session.** Staff, admins and owners (`classes:manage`) edit a session's name, description, dates and public flag (the price is set separately, from the session page). Delete is allowed only when the session has no classes. The database refuses the rest: migration `0035_session_delete_guard.sql` puts a trigger on `classes` (`classes_refuse_delete_with_classes`), so a delete that would cascade into classes fails even if the app check were missing.
- **Public flag.** A session is public only when staff tick "Public" in New session or Edit session. The session page has no toggle in this phase.
- **Public session pages** (migration `0029_public_sessions.sql`, `/camps/[slug]/sessions/[sessionId]`). Read without signing in. They list the session's upcoming classes and show no contact details and no enrolled campers. Off by default.
- **Time zones.** Class times are typed and shown in the user's own local zone and stored as UTC instants. The day-boundary rules (a class must fall on days inside its session) and the weekly series are worked out in the camp's time zone.

## Teachers and invites

- **Teacher role** is a membership role (`org_members.role = 'teacher'`, migration `0026`). It is not a person role. The six person roles (camper, participant, guardian, instructor, organizer, admin_staff) are the `CAMP_ROLES` list in `packages/domain`, and they describe people, not access.
- **Teacher calendar link** (migration `0033_teacher_calendar_tokens.sql`). Each teacher can make one personal link from Settings. It shows only the classes the teacher is assigned to. The camp link (migration `0028`) is unchanged, and it stays with admins and owners. Making a new link stops the old URL working at once.
- **Teacher invites by email** (migration `0038`, table `member_invites`). Staff, admins and owners add a person with the Instructor role on Add person, enter the email and send the invite. The link is shown once and expires after 7 days. The invited person opens it, signs in with the same email, confirms their profile and joins with the teacher role. Only a hash of the token is stored; sending again replaces the token, so the old link stops working. Pending invites to a person's email are removed when that person is deleted. Invites for the other roles show "Invites for this role are coming soon." Sign-up confirmation is not working end to end yet, so a new account may not be able to finish; see `docs/auth.md`.
- **Notifications** (migration `0037`) are one row per recipient, written from audit actions by the rules in `apps/server/src/notifications/rules.ts`. They are not invitations.

## People, team access and the camp switcher

- **People list pages.** The list shows 25 people a page, and a page can ask for up to 100. Search and the role filter are applied before paging, so the count and the page numbers match the filter. The page is in the address, so Back works (`packages/domain/src/people/paging.ts`).
- **One person form.** Add person and Edit person open the same pop-up (`PersonForm`). Roles are checkboxes in two groups: Family (camper, guardian) and Staff and participants (the rest). Only the ten role sets in `packages/domain/src/people/roleCombinations.ts` are saved; the form and the server refuse any other combination. A staff role is held one at a time, except that a guardian may also hold instructor, organizer or participant, and a camper may also hold participant.
- **Email.** One email per person, stored in `people.email`. The field is labelled Household email when a family role is ticked, and Email otherwise. The invite button stays disabled until the email is a valid address.
- **Household section.** Shown for a camper, or a guardian. On Add it links the person to a household. On Edit it shows the current household, but the household fields (the household and the relationship) are not saved on edit yet. The email and roles are saved.
- **Person page.** `/camp/people/[id]` shows four tiles in a two-column grid (one column on a narrow screen): Membership and Household on the first row, Badge and Attendance on the second. The Details card is gone. The email sits under the name, and Edit details and Archive person are in the header. Archive person needs `people:delete` and is hidden for an archived person.
- **Gap: date of birth and phone are not on the person page.** The server sends them to staff, and a `ContactDetails` component exists, but the page does not render it. To fix before real data.
- **Badge panel.** Admins and owners get Show badge, Reprint, Reissue and Revoke when a badge is active, and Issue badge when none is. Show and Reprint display the code; Reprint keeps the same code for a damaged card. Reissue makes a new code and revokes the old one, and shows "Badge reissued." with no code. Revoke shows "Badge revoked." and Issue shows "Badge issued.". Staff see the panel with a note that only admins can issue or revoke badges. The code is not in the page's props.
- **Staff order is not confirmed.** The order of the staff roles (admin staff, organizer, instructor, participant) is a placeholder (`STAFF_ROLE_ORDER_UNCONFIRMED`). No rule uses it, and the owner has not confirmed it.
- **Delete a person (owner only).** The owner gets a Delete button on each row, and a checkbox per row with select-all and Delete selected for a bulk delete. Both open a confirm dialog with an explicit Delete button. The delete removes the person's memberships, enrolments, check-ins, badges, instructor rows and household links, and the pending teacher invites to that email. It writes `person.delete` with no personal details. Archiving is a different action, open to admins and above (`people:delete`), and it keeps the record.
- **Manage access.** Admins and owners open Manage access from Team access to change each member's role, one row at a time. Nobody changes their own role. Only the owner makes or removes an owner, and the camp keeps at least one owner. Each change writes `member.role_change` with the old and new role (migration `0039`). Membership expiry is not built: Manage access changes roles only.
- **Camp switcher.** The camp name in the top bar opens a searchable list. Without a search it shows the eight most recent camps, and a search covers every camp. The list scrolls under a maximum height (half the window, at most 360px). Archived camps sit behind "Show archived", one row per camp. The switcher only switches camps. Rename, archive and delete are in Settings: a camp name card (rename, for admins and the owner) and the Danger zone (archive, for admins and the owner; delete, for the owner only).

## Moved from phase 2: recurring events, public class pages and the iCal feed

These were in the phase 2 roadmap row and moved here so that phase 2 closes on classes, sessions and enrolment alone.

- **Recurring sessions:** a weekly rule expands into normal sessions, each with its own enrolments. Overlap and capacity still apply to each. Tests cover month ends, DST days, and the count and until limits.
- **Public class pages:** a read-only page per class, listing its upcoming sessions, with no contact details and no enrolled campers. Only classes marked public.
- **iCal feed:** a read-only feed per camp that calendar apps subscribe to by URL, authenticated by an unguessable token stored as a hash. Archived camps return not found.

**Built** on the phase 3 branch: migrations 0028 (camp calendar token) and 0029 (public sessions). The earlier attempt used 0020 and 0021, which clash with shipped migrations, so the numbers were moved to 0028 and 0029.

Terms: a **session** (the parent row) is the public page's unit, and its **classes** are the time ranges a series generates. A public page lists a session's upcoming classes.

- **Recurring series:** staff add a series to a session from its page (`RecurringSeriesButton`, `addRecurringClasses`).
- **Making a session public:** the Public tick in New session and Edit session (see "Sessions, public pages and time zones").
- **Camp calendar link:** admins and owners make it in Settings (`CalendarLinkCard`, `rotateToken`). Making a new one stops the old URL working at once. Staff and teachers do not see the camp link.
- **Open:** the token is in the feed URL's query string. Calendar apps cannot send headers, so the token has to be in the URL. The remaining risk is platform request logs; check their retention.

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
- `org:archive` and `org:unarchive` are in the code for admin and owner. The Admin row now lists them. They are grouped under Admin. The default roles are the matrix's: owner has everything admin has, admin has everything staff has, and so on. "Built" means the code that uses the action exists today (phases 0 to 2 and the staff board). "Future" means the feature has not been built yet.

| Category                               | Permissions in it                                                                                                                                              | Default roles                                                                                                                                                                                                                               | Status                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Operations (check-in and on-site)      | `attendance:read`, `attendance:record`, `attendance:override`, `attendance:export`                                                                             | Staff: read and record. Admin and owner: also override and export. Viewer: none.                                                                                                                                                            | Built (phase 1 check-in)                                                                                                                                           |
| People (people and households)         | `people:read`, `people:read_contact`, `people:create`, `people:update`, `people:delete`, `people:authorise_pickup`, `memberships:manage`, `credentials:manage` | Viewer: read. Staff: read contacts, create and update. Admin: archive, pickup authority, memberships and check-in credentials. Owner: also delete a person (`data:erase`, owner only).                                                      | Built (phase 1)                                                                                                                                                    |
| Classes and events                     | `classes:manage`, `events:read`, `events:create`, `events:update`, `events:update_details`, `events:delete`                                                    | Viewer: read events. Staff: manage classes. Admin and owner: create, update and delete events, and change any field of a class. Teacher: change the name of its own classes (`events:update_details`).                                      | Built (phase 2)                                                                                                                                                    |
| Payments (payments and refunds)        | None yet                                                                                                                                                       | Decided in phase 9                                                                                                                                                                                                                          | Future (phase 9)                                                                                                                                                   |
| Registration                           | `registration:read`, `registration:submit`, `registration:confirm`, `registration:manage`, `holds:manage`                                                      | Viewer: none. Staff: read forms and submissions, record a registration, confirm a registration, place and release holds. Admin and owner: also create, edit and publish forms. Owner has everything admin has.                              | Built (this phase): forms, publishing, submissions and confirmation. Holds are built, but not taken from the registration. The waitlist UI is not built            |
| Team (members and roles)               | `members:read`, `members:leave`, `members:read_contact`, `members:invite`, `members:change_role`, `members:set_options`, `members:remove`                      | Viewer: read members and leave. Staff: invite teachers. Admin and owner: read contacts, invite teachers, change roles (Manage access), and turn a teacher's options on or off (`members:set_options`). Owner only: make or remove an owner. | Partly built: the list, Manage access (role change) and teacher invites are built. Invites for other roles and removal are planned. Membership expiry is not built |
| Work (boards, projects and tasks)      | `tasks:read`, `tasks:create`, `tasks:update`, `tasks:move`, `tasks:comment`, `tasks:delete`, `tasks:manage_board`                                              | Viewer: read. Staff: create, edit, move and comment. Admin and owner: delete and manage boards.                                                                                                                                             | Built (staff board)                                                                                                                                                |
| Admin (camp settings, delete and data) | `org:read`, `org:update`, `audit:read`, `org:delete`, `org:transfer_ownership`, `data:export`, `data:erase`                                                    | Viewer: read the camp. Admin and owner: rename the camp and read the audit log. Admin and owner also archive and unarchive the camp. Owner only: delete the camp, transfer ownership, export and erase data.                                | Partly built: renaming, archive, unarchive and (owner) delete are built; the audit log, transfer, export and erase are planned                                     |

### Teacher role

The camp roles are owner, admin, staff, viewer and teacher. A teacher is for the adults who run a class. Its default grants:

- `attendance:read`, limited to the sessions of the classes the teacher is assigned to.
- `events:read` and the people in those classes, so it can look up campers. Read-only, limited to the same classes.
- `events:update_details`: change the name of its own classes. A teacher may not change a class's camp size, ages, times, location, price or instructors (the server refuses the change with `teacher_field_refused`). Staff, admin and owner keep `events:update` for every field.
- No contact details, no edits to people or classes beyond the name, no team or admin rights, no money rights.

**Per-person options.** An admin (or owner) turns these on for one teacher on the Team page. Each option is off by default and grants only the one action it names, only to a teacher, and only inside its assigned classes. The options are listed in `MEMBER_OPTIONS` (`packages/domain/src/permissions.ts`) and stored in `member_options` (migration 0030).

- `teacher.check_in_out`: check campers in and out (`attendance:record`) in its assigned classes. Off by default; without it a teacher is refused check-in and check-out.

`authorize()` is the one decision point. The option is read into the actor for the request (`withMemberOptions`), and the assigned-classes scope is applied on top of it.

**Teacher view: My classes (branch `v0.3/feat/teacher-sessions`).** A teacher's sidebar has a "My classes" item, shown to the teacher role only, at `/camp/my-classes`. The page is read only. It lists the classes the signed-in teacher is assigned to (`class_teachers`), grouped by session: the session name and its dates, then each class with its start and end time in camp time (the camp's clock setting), its age range and its location. With no assignments it says "You are not assigned to any classes yet." The page is not found for every other role, and it shows no board, no tasks, no seat counts, no campers and no instructors. The server reads the classes through the same assigned-classes scope as the Sessions page (`listMyClasses` in `ClassService`, `teacherScopeOf`), so another teacher's classes are never loaded. No migration was needed.

**Status (issue #258, branch `v0.3/feat/teacher-role`; options on branch `v0.3/feat/permission-categories`):** built. The role is in migration 0026; assignments are `class_teachers` (migration 0027), set by staff and admins with `classes:manage`. The scope is `ASSIGNED_CLASSES_ONLY` in `packages/domain/src/permissions.ts`. The options are migration 0030, the `members:set_options` action (admin and owner, a teacher target only), and the check-in switch in the Team table. The teacher's sidebar is its own short list (no People, Team access, Work or Admin groups), its role pill is orange, and its class form shows the name only. Still to do: a browser check of the Team switch and of the teacher's class form.

## Open for review

- Hold length (proposed 15 minutes) and whether camps can change it.
- Whether a deposit or balance-later option is wanted once payments arrive (phase 9).
