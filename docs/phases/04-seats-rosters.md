# Phase 4: seats, groups and rosters

Status: **in progress.** Groups, rooms, assignments, the ratio override and the Groups and Assign screens are built on branch `v0.4/feat/groups-rooms-assignments` (migration 0047). The rest is listed under "Not built yet" below. Roadmap row: "Seats & rosters: groups, cabins, rooms, assign people, per-session check-in."
Depends on: phases 2 and 3.

## Moved from phase 3: seat holds and the waitlist

Built on branch `v0.3/feat/seat-holds`: holds reserve a place for a child (recorded with their household) for 15 minutes (`SEAT_HOLD_MINUTES`); capacity holds under concurrency through the database (migration 0025); a freed place goes to the first waitlisted enrolment, and each promotion is audited.

Built on branch `v0.3/feat/registration-holds` (migration 0043): the scheduled job `GET /api/cron/release-expired-holds` releases expired holds in every camp and promotes waitlists, guarded by `CRON_SECRET` (see `docs/deploy.md`). The `completed` release reason is in the table.

Built on branch `v0.3/feat/class-registration` (migration 0046): seats, holds and the waitlist sit on classes. A registration takes a hold for each child and class (15 minutes), a full class waitlists the child in order, confirmation releases each hold as `completed` and creates the enrolment, and a freed place goes to the first waitlisted child. The class page shows the held places and the waitlist in order, with a button to move the next camper off the waitlist when a place is free (`seatHolds.promoteWaitlist`, audited as `enrolment.promote`). Holds are listed by `seatHolds.listActiveHolds` (staff with `holds:manage`).

Built on branch `v0.4/feat/camp-holds-screen`: the camp-wide holds screen at `/camp/holds` (Operations, under Registration). It lists every live hold in the camp, in order of expiry, with the session, class, family, child, when the hold was placed and when it expires (in camp time), and a session filter. Each class's waitlist sits beside it, in join order, with each family's name and when the camper joined. It is read only; promotion stays on the class page. Both reads are one query each (`ClassRepository.listCampActiveHolds` and `listCampWaitlists`, Postgres and in memory, with a contract test), and both need `registration:read`, so staff, admins and the owner see the screen and teachers and viewers do not.

Built on branch `v0.4/feat/session-checkin` (migration 0049): per-session check-in. The check-in screen has a Session select listing the camp's sessions in progress today or starting today (camp time); with one such session it is pre-selected. A check-in names its session (`check_ins.session_id`, nullable, so camp-day visits keep null), and a camp with a session in progress today must name one. A camper with no active assignment (group and room) in that session is still checked in, with `check_ins.session_unassigned` set, the flag in the attendance audit entry, and the small note "Not assigned to a group in this session" on the result. Camps without sessions are unchanged. The on-site list has no session column, so it is unchanged.

Built on branch `v0.4/feat/hold-length-per-camp` (migration 0048): each camp sets how long a seat hold lasts, from 5 to 60 minutes, in the camp settings (`orgs.hold_minutes`, null for the default of 15, `SEAT_HOLD_MINUTES`). Only an admin or the owner changes it (`org:update`), and the database checks the range too. The hold service reads the camp's length when it places a hold, so a hold placed after a change takes the new length and holds already placed keep their expiry. The expiry cleanup uses each hold's own expiry, so it is unchanged.

Built on branch `v0.4/feat/roster-exports`: roster exports. A session's roster is a CSV (`/camp/sessions/[id]/roster.csv`, UTF-8 with a byte-order mark, an attachment) and a printable page (`/camp/sessions/[id]/roster`, with print styles, no camp navigation and a Print button hidden in print). Both list every camper and staff member placed in the session, grouped by group, then room, then name. The roster builder is pure (`buildRoster` in `packages/domain/src/groups/roster.ts`), and the CSV escapes RFC 4180 and neutralises spreadsheet formulas (a cell starting with `=`, `+`, `-`, `@`, a tab or a CR gets a leading apostrophe, `apps/shared/src/csv.ts`). The export reads through the same calls as the Groups and Assign screens, so it needs the same permission: every role except a teacher without a class. A viewer receives names and roles only, which the Assign board already shows. The Groups and rooms page has the two export buttons. A session from another camp is not found.

Built on branch `v0.4/feat/session-tabs`: the session page has three tabs, Classes, Registrations and Holds, selected by `?tab=` in the URL (refresh and back keep it; an unknown tab shows Classes). Classes is the existing content. Registrations lists the registrations that ask for this session, grouped by form, with each family's children, classes and status (held, waitlisted, confirmed, paid), reusing the form page's table and actions. Holds shows this session's live holds (in expiry order) and its waitlist (in join order), reusing the camp-wide holds board filtered to the session. Both need `registration:read`, the same read as the Registration and Holds screens: a viewer or a teacher does not see the two tabs, and a URL that names one shows Classes. The Registration page lists every registration across sessions with a search box, and each row links to its session's Registrations tab. The camp-wide Holds page is unchanged, and each session name on it links to that session's Holds tab. The tab rules are pure (`apps/shared/src/camp/sessionTabs.ts`).

Built on branch `phase4-fixups` (migration 0050): prices are per class. A session (a row of `classes`) carries no price, and each class (a row of `sessions`) carries its own price and early-bird fields, so a family pays per class. The class form and the recurring series form take the price; the session form does not, and a price sent with a session is refused. The class list shows each class's price, and the public session page shows it beside each class. Rosters (the CSV and the printable page) list campers and staff only and show no price. Migration 0050 copies each session's price onto its classes before it drops the session columns; the seat, hold and roster rules are unchanged.

Built on branch `v0.4/feat/session-delete-archive` (migration 0052): archive and delete of sessions. A session (a row of `classes`) with classes is not deleted by a plain delete. Its prompt offers two actions. **Archive session** sets `classes.archived_at`: the session and its classes stay, it is hidden from registration (the take-a-registration page and submissions) and from its public page, and the list shows an "Archived" pill. Unarchive needs `org:update` (admin and owner). **Delete classes and session** needs `classes:delete_with_classes` (admin and owner, granted in `packages/domain`), asks the person to type the session name exactly, and calls `buxa_delete_session_with_classes_v1`, which removes the classes and then the session in one statement. The function refuses a session whose classes have an enrolment, a seat hold, a registration, a check-in or a season pass, with "This session has enrolments, archive it instead", and deletes nothing. It is the owner's rule that deleting enrolments is not allowed, so those links stop a delete rather than cascade. Check-ins and season passes are refused too, because their link to a session would otherwise be cleared and the history lost. Each class writes `class.delete` and the session `session.delete`, in the same transaction. The bulk delete reports a refused session as "Not deleted: <name> (has classes; archive it instead)". The row trash deletes only its own row. Session names are unique per camp, ignoring case and surrounding or repeated spaces: the service refuses a duplicate on create and edit, and a unique index on the normalised name is added by migration 0050 only when no camp already has duplicates (the migration stops and lists them otherwise). Tests: `apps/server/src/classes/sessionArchiveAndDelete.test.ts`, `packages/db/test/session-archive-delete.test.ts` (Postgres, with the duplicate-name upgrade check), and the session prompt and row tests under `apps/web/components/components/classes`.

Built on branch `v0.4/feat/session-lifecycle` (migrations 0053 and 0054): the session lifecycle and the registration lifecycle (full description in `docs/phases/03-registration.md`). A session is a draft, live or archived. Only a live session takes enrolments and seat holds: `lockClass` (the enrolment and registration path) and `placeHoldInTransaction` refuse a draft or archived session with `SessionNotLiveError`, so a seat is never taken in a closed session, and the capacity trigger and lock order are unchanged. Withdrawing a registration releases its seat holds (`releaseHoldInTransaction`, reason `cancelled`) and cancels its enrolments (`cancelInTransaction`, which promotes the waitlist), so a withdrawn family's places go to the next on the waitlist. Deleting a registration with enrolments is refused until it is withdrawn. A live session cannot be deleted while any class has an enrolment, hold or registration; a draft is deleted with everything under it, including its groups, rooms and assignments, after a typed-name confirmation that lists them.

Built on branch `v0.4/feat/session-date-edit` (migration 0059): session date edits flag the classes that fall outside the new dates. A class outside its session's new first and last day is flagged (`sessions.dates_outside_session`) and keeps its times; the save and the flags are one transaction, and each newly flagged class is audited (`class.dates_flagged`). A shrink is refused, naming the classes, when an affected class has an enrolment, a seat hold or a registration (or its session has a check-in). A flagged class takes no seat, hold or registration place, is not on the registration picker or the public page, and blocks its session from going live, until its dates are fixed by a save inside the session. The full rules are in `docs/phases/03-registration.md` ("Session dates and flagged classes"). Rosters are unchanged: a flagged class is never placed, so it has no campers to list.

Not built yet:

- Nothing about holds per household remains open: holds are per child since migration 0055, so siblings can each take the same class (see `docs/phases/03-registration.md`). Group and room names are unique per session after normalisation (NFKC, space-like characters), the same rule as session names.

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

## Built: groups, rooms and assignments

- **Data (migration 0047).** `groups`, `rooms` and `assignments`, each with `org_id` and forced row-level security. A group and a room belong to a session (the Session row, the one with dates that the URL `/camp/sessions/[id]` shows). A group has a capacity, an optional staff ratio (campers per staff member), and an optional age range. A room has a name, a location, a capacity and its session. An assignment places one person as a `camper` or `staff` in one group and one room. A partial unique index allows one active assignment per person per session, so the database refuses a second one. Composite foreign keys keep a group and a room in the same session as the assignment.
- **Rules (`packages/domain/src/groups`, pure and tested).** Checked in this order: override validity, the role held, group capacity (campers only; staff do not count), the age range on the session's first day (reusing phase 2's `checkAge`), room overlap (reusing phase 2's overlap rule, on the session's days: sharing a day clashes, the next day touches), room capacity, and the staff ratio. Only a ratio refusal can be overridden.
- **Override.** An admin or owner (`attendance:override`) can override a ratio refusal with a reason of 1 to 500 characters. The reason is stored on the assignment (`ratio_override_reason`) and written to the audit log as `assignment.override`. A reason that is blank is refused, and a non-admin who sends one is refused.
- **Placing and moving.** `groups.assign` (service) and `assignInTransaction` (Postgres) lock the person, then the group, then the room (and the room's name and place, across sessions), in that fixed order, and run the rules on fresh counts. Two parallel placements into the last place of a group give one success. A move updates the person's one active assignment in that session. Every change writes its audit entry in the same transaction: `group.create`, `group.update`, `room.create`, `room.update`, `assignment.create`, `assignment.move`, `assignment.override`.
- **Permissions.** Reads need `people:read` (every role). Writes need `classes:manage` (staff and above), so a viewer is refused with a 403 when placing anyone.
- **Screens.** `/camp/sessions/[id]/groups` (groups and rooms, with capacity, campers, staff and ratio; New and Edit in `FormPopUp`) and `/camp/sessions/[id]/assign` (each group with its members and room, the campers not placed yet, and a Place or move pop-up). A refusal shows as small polite text under the form. A ratio refusal opens a second pop-up that asks for the reason. The session page links to both.
- **Model choices to review.** Room identity is its name and location, case-insensitive, within the camp: each session books its own room rows, and the rule checks the other sessions' uses of the same name and place. A group's capacity counts campers only. Staff count toward the ratio only. A session without dates cannot take placements yet (refused as "session_undated").

## Built: unassign a person from a group

- **Service.** `groups.unassign` (`GroupService`) and `unassign` in the repository end a person's one active assignment in a session. The row is set inactive (`assignments.active = false`); nothing is deleted, and the partial unique index lets the person be placed again in the same session.
- **Locks.** The same locks as a placement, in the same order: the person, then the group, then the room (with the camp-wide room lock). The placement is read under the person's lock, then again under the group and room locks; if it changed, the call is refused as a conflict (`PgUnassign.ts`).
- **Refusal.** A person with no active assignment in the session is refused with the reason `not_assigned` ("This person is not placed in this session, so there is nothing to unassign."). Nothing is written.
- **Permission.** The same as assign: `classes:manage` (staff and above). A viewer or a teacher is refused with a 403.
- **Audit.** Every unassign writes `assignment.unassign` in the same transaction, with the session, person, group and room.
- **Screen.** On the Assign page, each member of a group has an Unassign button, shown only to roles with `classes:manage`. It opens a short confirmation pop-up (`FormPopUp`) that names the person and the group. Success shows a toast; a refusal shows as small polite text.

## Built: one source for a class's teachers (migration 0051)

Built on branch `v0.4/fix/teacher-person-link`. Decision (owner): a class's teachers are its instructors. The class table's Instructors column, the Edit class popup and teacher access all read `session_instructors`, keyed by person.

- **Login link.** `people.user_id` links a roster person to the teacher's login. It is nullable, unique per camp, and has a composite foreign key to the camp's membership, so a person can be linked only to a login that belongs to the same camp. Removing the membership clears the link.
- **Setting the link.** `buxa_accept_invite` links the accepting login to the person with the invited email in that camp (the oldest unlinked one), or creates that person with the instructor role when none exists. The invite email must still match the login.
- **Teacher access.** A teacher sees a class only when its linked person is one of the class's instructors. A teacher with no linked person sees no classes. Staff keep their rules. The same read drives the scope (`assignedClassIds`, `teacherScope`), My classes, the teacher calendar feed (`buxa_teacher_calendar_feed_classes`) and the audit notices (`notifyForAudit`).
- **Removed.** The Teachers section on the session page, `setTeachers` and `listTeacherAssignments`, their server action, and their tests. The Edit class popup and its save path are unchanged.
- **Backfill and the unmatched-row rule.** Migration `0051` links each `class_teachers` login to the one person in the camp with the same email (case-insensitive, trimmed) when that is unambiguous: one matching person, not already linked, and matched by one login only. It copies each linked row into `session_instructors` once. A row with no unambiguous match is not copied, is listed in a migration NOTICE (class and email), and keeps `class_teachers` in place. The owner reviews those rows and links or re-adds them by hand. Only when every row matches is `class_teachers` dropped (with its trigger and its assignment function). The migration test covers both outcomes.

## Not built yet

- **Roster exports** (CSV and printable page), and the export guard for viewers and CSV formula neutralisation.
- **Per-session check-in** that records the session and flags a camper who is not assigned to it.
- **A camp-wide holds screen** (holds across every class, not one class at a time). Phase 3 still shows holds for one class only.
- **Hold length per camp.** Holds are fixed at 15 minutes (`SEAT_HOLD_MINUTES`).

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

## Class series and occurrences (v0.4, branch `v0.4/feat/class-series`, in progress)

**Terms.** A **session** is a row of `classes` (date range). A **class** is a **series** (`class_series`): the name, ages, camp size, location, price, weekdays and first and last allowed times. Its days are **occurrences**: the rows of `sessions` the app used to call classes. Each occurrence keeps its own date and time of day, and its own status (`active` or `cancelled`), `cancelled_at` and `cancel_reason`.

**Built.**

- Migration `0060_class_series.sql`: the series table (org-scoped, row-level security, no DELETE for the request role), the occurrence status columns and `sessions.series_id`. Existing occurrences are grouped into series by the rule in the file header: same session, name, ages, capacity, location, price and currency, early-bird amount and day, instructor set, and time of day (camp time). The migration stops, changing nothing, when two occurrences of one group fall on the same day, and lists them. A row written without a series (the release still running) gets its own one-occurrence series.
- Migration `0061_series_enrolment_keys.sql`: the enrolment key (below), the capacity checks per series and the overlap check across series. It stops and lists a child with two active enrolments or holds in one series, or with enrolments in two series whose active occurrences overlap.
- Domain (`packages/domain/src/classes/series.ts`): `planSeries` (weekdays and first and last allowed times to occurrences, reusing the weekly rule), `normaliseWeekdays` (at least one day), `decideCancel` and `decideRestore` (a day can be cancelled once and restored once; a reason of 1 to 500 characters), and `findSeriesClash` (active days only; a day that only touches does not clash).
- Server: `cancelOccurrence` and `restoreOccurrence` (`classes:manage`). The write locks the day, applies the domain decision and writes `occurrence.cancel` or `occurrence.restore` in the same transaction. A refused change writes nothing.

**Enrolment key (decision).** `enrolments`, `seat_holds` and `registration_classes` carry `series_id`. It is the key for everything that counts a child's place: one active enrolment or hold per child per series (a unique index), the capacity count and its lock (`class_series.capacity`), and the overlap check. `session_id` stays on those rows as the **anchor**: the occurrence the row was made against. A composite foreign key `(org_id, session_id, series_id)` makes the anchor belong to its own series. Cancelling an occurrence does not move or remove an enrolment. Existing duplicates stop the migration (see its header).

**Built since (migration `0064_series_occurrence_status.sql`).**

- **One series from the New class form.** The form takes the weekdays ticked (Monday to Friday by default, at least one) and the Starts and Ends date-times in camp time. The server runs `planSeries` and writes the series row and every day in one transaction (`addSeries`, audited `series.create` and `class.create` per day). The single-class path is not used from a class form.
- **Cancelled days are left out of the public list, the teacher feed (My classes and the calendar feed) and the camp calendar feed.** Migration 0064 filters `sessions.status` in `buxa_public_classes_v2`, `buxa_teacher_calendar_feed_classes` and `buxa_calendar_feed_classes`. The check-in list reads sessions, not days, so it has no day rows to filter.
- **One row per series on the session page.** The Classes table shows the series' name, ages, days (`Mon to Fri`, `Mon, Wed`), times (its first day's clock times), location, instructors, camp size, price, enrolled, waitlisted and places. The Classes count and the session list count series. Enrol, enrolments and holds are keyed by the series; the anchor day (`anchorClassId`, the first active day) is the id a pick uses.
- **Edit and delete act on the series.** Edit is the New class form, prefilled from the series (the same fields, intro and footer, with Save class). Name, ages, camp size, location, instructors and price change on every day. A change to the weekdays or to Starts and Ends plans the days again: the days it adds are written with the saved fields, and the active days no one is on are removed (`buxa_delete_occurrences_v1`, migration 0066). A removed day that a child, a hold or a registration is on refuses the whole edit and names them ("Mia is in Art Camp on Mon 12 Jul, which this change removes. Unenrol them first, then save again."); cancelled days are left as they are. Each change is audited in one transaction (`series.update`, `series.reschedule`, `class.create`). A teacher on the series changes the name only. Delete removes the series and its days; a series with an enrolment, hold or registration is refused with "The class has enrolments", and nothing is deleted (`buxa_delete_series_v1`).
- **Days panel.** `Days` on a row opens the series' days (`?days=<series id>`): each day's start and end, Active or Cancelled with its reason. Staff cancel one day with a reason (`occurrence.cancel`) or restore it (`occurrence.restore`). The series and its other days are unchanged, and a cancelled day keeps its enrolments.
- **Readable refusals.** A child already enrolled in a series: "Mia is already enrolled in Art Camp". A full series: "Art Camp is full. The camper can be put on the waitlist instead." A clash: "Mia is already in another class at this time: Swim Stars (Mon 5 Jul, 11:00-13:00)".

**Not built yet.**

- Pickers on the registration and enrolment forms still offer days, not series (one choice per series is still to do).
- The camp calendar, the check-in list and My classes are filtered for cancelled days in SQL and in the service; the check-in list reads sessions, so there is no day row in it to hide.
- Series page as its own route: the days open as a panel on the session page.

## Check-in with a family's email (v0.4, issue #408, migration 0068)

A family without a sign-in checks its children in on a phone, using the camp's check-in link. The family proves it is the registering family with a code sent to the registration email. Staff can do the same at the desk when a family has no phone. Nothing here is a parent login.

1. **Verification at registration.** The registration confirmation email carries a link to the camp's verification page. The family enters the 6-digit code sent to the registration email (the guardian email on the registration), once. On success the browser gets a device token. The token is random, stored only as a hash, scoped to one camp and one household, expires at the camp's season end (the latest occurrence's end, when that is still ahead) or after 180 days, and staff with `attendance:record` can revoke it.
   - _Status:_ the verification page and its code step are built as the gate's email step (step 3). The confirmation email itself is not sent (see "Email is not configured" below).
2. **Gate.** Each camp has one static check-in link (`/gate/<token>`), to be printed as a QR code. An admin (`org:update`) can replace it; the old link then stops working. The token is stored as a keyed hash, and an encrypted copy (the badge cipher) lets an admin show the link again. A phone with a live device token for the camp sees the family's children booked into a live session today (camp time), one plain line each. The family ticks the children who are here and checks them in. Each child is one check-in (`attendance.check_in`, `via: gate`), audited in the same statement. A phone with no device token goes to the email step.
3. **Email step at the gate.** The family enters the registration email. The answer is always the same ("If that email is on file, a code is on its way."), whether or not the email is on file. If the email matches a guardian on a registration in this camp, a 6-digit code is sent to it. The code expires in 10 minutes, is stored as a keyed hash, and allows 5 attempts; the fifth wrong attempt voids it. A new code can be asked for once every 60 seconds per family. The children are shown only after the code matches; the device token is issued then, once for that code.
4. **Desk fallback.** Staff with `attendance:record` (owner, admin, staff; not a teacher or a viewer) open the same check-in page, enter the family's email, and the code goes to that address. The parent reads it out and staff enter it. The children appear only after a match. Staff then check each child in through the existing check-in, so the desk keeps its rules (overrides, sessions, unassigned flags). Staff may also check in by name, as today. The desk issues no device token.
5. **Security.** Codes and device tokens are never stored or logged in clear. Hashes are HMAC-SHA256 keyed with `GATE_PEPPER` (at least 32 characters, from the server environment; unset, the gate answers 503 and does not run). Rate limits (`apps/server/src/rateLimit/limiter.ts`, `gate.*` rules): code requests per client address (20 per 10 minutes) and per email (5 per hour, keyed by a hash); code entries per address (30 per 10 minutes) and per email (20 per 10 minutes). Each verification, device issue, revocation, link rotation and check-in writes its audit row in the same transaction. Tokens are camp-scoped in the database (`org_id`, forced row-level security) and hold no personal data. Detail is in `docs/security.md`, section 2.
6. **Data (migration 0068).** `camp_gates` (the link: hash, sealed copy, rotation), `gate_verification_codes` (hash, household, purpose `gate` or `desk`, `expires_at`, `attempts`, `used_at`, `verified`, `device_issued`), and `device_tokens` (hash, household, camp, `issued_at`, `expires_at`, `revoked_at`). The verification codes have no grant and no policy for the request role: only the definer functions `buxa_gate_*_v1` and `buxa_booked_today` touch them. The device lookup, the children and the gate check-in are definers that prove the device first.

**Where the code lives.** Domain rules: `packages/domain/src/gate/rules.ts`. Server: `apps/server/src/gate/` (service, Postgres and in-memory repositories, sender, secrets). Composers: `apps/server/src/composers/gate/gateActions.ts`. Web: `apps/web/app/gate/[token]/page.tsx` (the gate), `apps/web/components/components/gate/` (the email and code steps, the child lines, the desk section, the link and devices panel), and the desk section on the check-in page. The pages were not checked in a browser in this change.

**Email is not configured.** The repository has no email provider. Invites are listed in the dev outbox and never sent. The code sender (`apps/server/src/gate/codeSender.ts`) therefore sends nothing in production: it logs that no provider is configured, with no code and no address. In development it logs the message, code included, so a developer can check in. Until a provider is wired behind `CodeSender`, no family can receive a code in production, and the gate is unusable there.

**Not built.**

- A single family QR (one code for the whole family, not per camp link). The link is per camp.
- A parent portal login. Families do not sign in; the phone's device token is the only memory.
- Email delivery (above), and the confirmation email's link.
- Checking a season pass or membership at the gate. The gate's check-in rules are those of the database function (booked today, not already on site, not archived). The desk check-in still applies the full rules.
- A screen for gate events. They are in the audit log (`gate.code_request`, `gate.verify`, `gate.device_issue`, `gate.device_revoke`, `gate.rotate`, `attendance.check_in` with `via: gate`).
