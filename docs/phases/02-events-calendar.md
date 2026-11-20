# Phase 2: classes, sessions and enrolment

Status: **built** for this slice (sessions and classes, enrolment, bulk import and the sessions screens). Recurring events, public pages and the iCal feed moved to phase 3 (`docs/phases/03-registration.md`). Roadmap row (phase 2, `docs/ROADMAP.md`): "Events & calendar: programs to sessions, capacity, enrolment."
The v0.3 functional checkup changed the model: a **session** is now the parent (a date range), and its **classes** are the time-range rows. The data model and migration `0022` are in `docs/plans/sessions-classes.md`. The screens moved from `/camp/classes` to `/camp/sessions` (the old addresses redirect permanently).
This spec covers the first slice of that row: sessions and their classes, and who is enrolled. Recurring events, public pages and the iCal feed moved to phase 3, so this phase's exit does not depend on them.

## Words we use

- **Session**: a named period the camp runs, for example "Summer week 1", with a description and a date range (first and last day, in the camp's time zone). A session holds classes.
- **Class**: one scheduled run inside a session, for example "Robotics, Monday 9:00-12:00". A class has a name, a time range, an age range, a camp size (3 to 30 places), a location and its own instructors. The class is the unit that is scheduled and enrolled in.
- **Enrolment**: one camper in one class, with a status (enrolled, waitlisted, cancelled). A camper may hold several enrolments, but never two that overlap in time.
- **Camp size**: the number of places in a class, a whole number from 3 to 30. The class is full when its enrolled campers reach the camp size.
- **Instructor ratio**: the number of campers allowed per instructor. The database still stores the ratio columns, but the app no longer shows or writes them. It is not enforced.
- **Age range**: minimum and maximum age for a class, whole numbers from 3 to 20. Checked when a camper is enrolled.

## Decisions

1. A session holds several classes. Classes are the unit that is scheduled and enrolled in.
2. Overlapping enrolments are blocked by default, across all classes in the camp, not only within one class. An admin may override with a reason, recorded in the audit log.
3. Age limits are enforced at enrolment. Instructor ratios are not shown in the UI and not enforced; the columns stay in the database.
4. A class's camp size is a hard limit: no more enrolments than the camp size, even when two people enrol at the same moment.
5. A class's local days must fall inside its session's date range. The session's range is typed in and is only widened automatically by a class outside it.

## Acceptance criteria

- Staff can create a session with a name, description and date range.
- Staff can add classes to a session with a name, a start, an end, an age range, a location, instructors and a camp size. Staff can edit and delete a class; a class with any enrolment cannot be deleted.
- The class form opens as a pop-up.
- Enrolling a camper into a class fails with a clear reason when: the camper is outside the age range; the class is full; the camper has an overlapping enrolment (unless overridden by an admin with a reason).
- Cancelling an enrolment frees its place and its time.
- Every change is written to the audit log in the same transaction.
- Viewers see classes and sessions but not the contact details of enrolled campers.

## Exit tests (must pass in CI before the phase is done)

- Domain: overlap detection for sessions that touch, nest or cross midnight; age range boundaries inclusive; capacity limit.
- Domain: an admin override is allowed only with a reason and is recorded.
- Database: two concurrent enrolments into the last place result in exactly one success (concurrency test).
- Database: row-level security keeps one camp's classes and enrolments invisible to another camp.
- UI: a full session shows a waitlist option instead of enrolling; a blocked overlap explains which other session it clashes with.

## Owner checks

The owner checks that were carried over from phase 1 (phone timing, install and sign-in from a phone, the production walkthrough, and the 390px and 1280px screen check) moved to one pass after phase 4: see `docs/phases/owner-acceptance.md`. Phase 2 is not blocked on them.

## Not in this phase

Recurring events, public class pages and the iCal feed (moved to phase 3), payments, waitlist promotion, automatic ratio enforcement, and check-in per session (check-in stays per camp day for now).

## Open for review

- Whether a camper can be waitlisted automatically, or staff add them by hand.
- Whether check-in per session is needed in phase 2 or phase 4 (seats and rosters).

## Bulk import of classes and sessions

A camp season can have dozens of camps and many sessions a day, so staff create them in bulk from a spreadsheet.

### Decisions

1. **CSV template, not PDF.** The app provides a downloadable template (opens in Excel or Google Sheets). A printed or scanned PDF is not parsed. A fillable PDF with the same fields may come later.
2. **Preview before save.** An upload is checked row by row and saved only when the owner confirms. Nothing is written during preview.
3. **Each row gets its own result:** ready, or an exact error naming the row, the field and the clash (for example "Robotics 9:00-12:00 overlaps Art 10:00-12:00 for the same camper group").
4. **Rules are the same as manual entry.** Overlaps, age ranges, capacity and the override rule from this spec apply to every row. An import cannot bypass them.
5. **External key.** Each row has an optional external key. A re-upload with the same key updates the matching class instead of creating a duplicate. Rows without a key are created once; re-uploading them is reported as a duplicate, not created again.
6. **Atomic confirm per file.** The confirmed rows are written in one transaction. If any write fails, none of the file is saved and the owner gets the reason.
7. **Audit.** One audit entry for the upload (who, when, file name, row counts) and one per saved class.

### Template columns

`external_key`, `class_name`, `starts_at`, `ends_at` (camp local time, ISO format), `location`, `age_min`, `age_max`, `capacity`, `instructor_names` (semicolon separated), `ratio_campers`, `ratio_instructors`.

The names are the file format and are not renamed. `class_name` is the name of the **session** the row goes under: the import matches it against existing sessions and does not create them. The ratio columns stay in the file format, although the app no longer shows them.

### Acceptance criteria

- Staff with `classes:manage` can download the template, upload a filled file, see a preview with every row's result, and confirm.
- A file with 300 rows previews in under 5 seconds and saves in one transaction.
- Re-uploading the same file with keys creates no new classes.
- A row that clashes with an existing class, or with another row in the same file, is refused with the clashing row named.
- A failed confirm saves nothing.

### Exit tests (added to this phase's list)

- Preview refuses overlaps within the file and against existing sessions (table-driven, including sessions that touch and cross midnight).
- Re-upload with the same external keys is idempotent.
- Confirm is atomic: a database error mid-file leaves zero new rows.
- Formula neutralisation applies to the template download and to any exported error report.
- A viewer cannot upload (403).

### Not in this feature

Room and instructor double-booking across the whole day (phase 5), PDF parsing, and images of schedules.
