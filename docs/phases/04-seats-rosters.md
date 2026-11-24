# Phase 4: seats, groups and rosters

Status: **in progress.** Groups, rooms, assignments, the ratio override and the Groups and Assign screens are built on branch `v0.4/feat/groups-rooms-assignments` (migration 0047). The rest is listed under "Not built yet" below. Roadmap row: "Seats & rosters: groups, cabins, rooms, assign people, per-session check-in."
Depends on: phases 2 and 3.

## Moved from phase 3: seat holds and the waitlist

Built on branch `v0.3/feat/seat-holds`: holds reserve a place for a household for 15 minutes (`SEAT_HOLD_MINUTES`); capacity holds under concurrency through the database (migration 0025); a freed place goes to the first waitlisted enrolment, and each promotion is audited.

Built on branch `v0.3/feat/registration-holds` (migration 0043): the scheduled job `GET /api/cron/release-expired-holds` releases expired holds in every camp and promotes waitlists, guarded by `CRON_SECRET` (see `docs/deploy.md`). The `completed` release reason is in the table.

Built on branch `v0.3/feat/class-registration` (migration 0046): seats, holds and the waitlist sit on classes. A registration takes a hold for each child and class (15 minutes), a full class waitlists the child in order, confirmation releases each hold as `completed` and creates the enrolment, and a freed place goes to the first waitlisted child. The class page shows the held places and the waitlist in order, with a button to move the next camper off the waitlist when a place is free (`seatHolds.promoteWaitlist`, audited as `enrolment.promote`). Holds are listed by `seatHolds.listActiveHolds` (staff with `holds:manage`).

Built on branch `v0.4/feat/camp-holds-screen`: the camp-wide holds screen at `/camp/holds` (Operations, under Registration). It lists every live hold in the camp, in order of expiry, with the session, class, family, child, when the hold was placed and when it expires (in camp time), and a session filter. Each class's waitlist sits beside it, in join order, with each family's name and when the camper joined. It is read only; promotion stays on the class page. Both reads are one query each (`ClassRepository.listCampActiveHolds` and `listCampWaitlists`, Postgres and in memory, with a contract test), and both need `registration:read`, so staff, admins and the owner see the screen and teachers and viewers do not.

Built on branch `v0.4/feat/session-checkin` (migration 0049): per-session check-in. The check-in screen has a Session select listing the camp's sessions in progress today or starting today (camp time); with one such session it is pre-selected. A check-in names its session (`check_ins.session_id`, nullable, so camp-day visits keep null), and a camp with a session in progress today must name one. A camper with no active assignment (group and room) in that session is still checked in, with `check_ins.session_unassigned` set, the flag in the attendance audit entry, and the small note "Not assigned to a group in this session" on the result. Camps without sessions are unchanged. The on-site list has no session column, so it is unchanged.

Built on branch `v0.4/feat/hold-length-per-camp` (migration 0048): each camp sets how long a seat hold lasts, from 5 to 60 minutes, in the camp settings (`orgs.hold_minutes`, null for the default of 15, `SEAT_HOLD_MINUTES`). Only an admin or the owner changes it (`org:update`), and the database checks the range too. The hold service reads the camp's length when it places a hold, so a hold placed after a change takes the new length and holds already placed keep their expiry. The expiry cleanup uses each hold's own expiry, so it is unchanged.

Built on branch `v0.4/feat/roster-exports`: roster exports. A session's roster is a CSV (`/camp/sessions/[id]/roster.csv`, UTF-8 with a byte-order mark, an attachment) and a printable page (`/camp/sessions/[id]/roster`, with print styles, no camp navigation and a Print button hidden in print). Both list every camper and staff member placed in the session, grouped by group, then room, then name. The roster builder is pure (`buildRoster` in `packages/domain/src/groups/roster.ts`), and the CSV escapes RFC 4180 and neutralises spreadsheet formulas (a cell starting with `=`, `+`, `-`, `@`, a tab or a CR gets a leading apostrophe, `apps/shared/src/csv.ts`). The export reads through the same calls as the Groups and Assign screens, so it needs the same permission: every role except a teacher without a class. A viewer receives names and roles only, which the Assign board already shows. The Groups and rooms page has the two export buttons. A session from another camp is not found.

Built on branch `v0.4/feat/session-tabs`: the session page has three tabs, Classes, Registrations and Holds, selected by `?tab=` in the URL (refresh and back keep it; an unknown tab shows Classes). Classes is the existing content. Registrations lists the registrations that ask for this session, grouped by form, with each family's children, classes and status (held, waitlisted, confirmed, paid), reusing the form page's table and actions. Holds shows this session's live holds (in expiry order) and its waitlist (in join order), reusing the camp-wide holds board filtered to the session. Both need `registration:read`, the same read as the Registration and Holds screens: a viewer or a teacher does not see the two tabs, and a URL that names one shows Classes. The Registration page lists every registration across sessions with a search box, and each row links to its session's Registrations tab. The camp-wide Holds page is unchanged, and each session name on it links to that session's Holds tab. The tab rules are pure (`apps/shared/src/camp/sessionTabs.ts`).

Built on branch `phase4-fixups` (migration 0050): prices are per class. A session (a row of `classes`) carries no price, and each class (a row of `sessions`) carries its own price and early-bird fields, so a family pays per class. The class form and the recurring series form take the price; the session form does not, and a price sent with a session is refused. The class list shows each class's price, and the public session page shows it beside each class. Rosters (the CSV and the printable page) list campers and staff only and show no price. Migration 0050 copies each session's price onto its classes before it drops the session columns; the seat, hold and roster rules are unchanged.

Built on branch `v0.4/feat/session-delete-archive` (migration 0052): archive and delete of sessions. A session (a row of `classes`) with classes is not deleted by a plain delete. Its prompt offers two actions. **Archive session** sets `classes.archived_at`: the session and its classes stay, it is hidden from registration (the take-a-registration page and submissions) and from its public page, and the list shows an "Archived" pill. Unarchive needs `org:update` (admin and owner). **Delete classes and session** needs `classes:delete_with_classes` (admin and owner, granted in `packages/domain`), asks the person to type the session name exactly, and calls `buxa_delete_session_with_classes_v1`, which removes the classes and then the session in one statement. The function refuses a session whose classes have an enrolment, a seat hold, a registration, a check-in or a season pass, with "This session has enrolments, archive it instead", and deletes nothing. It is the owner's rule that deleting enrolments is not allowed, so those links stop a delete rather than cascade. Check-ins and season passes are refused too, because their link to a session would otherwise be cleared and the history lost. Each class writes `class.delete` and the session `session.delete`, in the same transaction. The bulk delete reports a refused session as "Not deleted: <name> (has classes; archive it instead)". The row trash deletes only its own row. Session names are unique per camp, ignoring case and surrounding or repeated spaces: the service refuses a duplicate on create and edit, and a unique index on the normalised name is added by migration 0050 only when no camp already has duplicates (the migration stops and lists them otherwise). Tests: `apps/server/src/classes/sessionArchiveAndDelete.test.ts`, `packages/db/test/session-archive-delete.test.ts` (Postgres, with the duplicate-name upgrade check), and the session prompt and row tests under `apps/web/components/components/classes`.

Not built yet:

- A hold for each child in a household. One active hold per household per class still applies, so a second child of the same household cannot take the same class at the same time (see `docs/phases/03-registration.md`).

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
