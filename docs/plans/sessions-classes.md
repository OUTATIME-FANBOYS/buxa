# Sessions and classes: data model and migration

Status: proposal for v0.3 (branch `v0.3/feat/sessions-classes`), migration `0022_sessions_parent_classes.sql`.

## Terms

- **Session**: the parent event. It has a name, an optional description and a **date range** (`starts_on`, `ends_on`, camp-local dates, inclusive), for example a two-week camp period.
- **Class**: one item under a session with a **time range** (`starts_at`, `ends_at`, instants). It has a name, an age range, a camp size (3 to 30 places), a location and instructors. Campers enrol in a class.
- **Enrolment**: a camper in a class (unchanged).

## Physical tables (names kept)

The tables keep their names because the release still running during a deploy reads and writes them; a rename would break it at once. Until a later contract release, the physical names are inverted relative to the terms above:

| Table                                                     | Holds                                          | Term in the app |
| --------------------------------------------------------- | ---------------------------------------------- | --------------- |
| `classes`                                                 | the parent rows (formerly the class template)  | Session         |
| `sessions`                                                | the time-range rows (formerly the occurrences) | Class           |
| `enrolments.session_id`, `session_instructors.session_id` | point at `sessions`                            | Class           |

## Changes in 0022 (expand only)

1. `classes`: add `starts_on date` and `ends_on date` (nullable for old rows with no occurrences). `default_capacity` loses NOT NULL, because a session has no camp size of its own.
2. `sessions`: add `name text`, `age_min integer`, `age_max integer` (nullable, with the same checks as the old template columns).
3. Backfill in the camp's time zone (`orgs.timezone`):
   - each session's `starts_on` and `ends_on` = the earliest and latest local day of its classes;
   - each class's `name`, `age_min` and `age_max` = copied from its session.
4. Trigger `sessions_fill_from_session` (BEFORE INSERT): when a class row arrives without a name or ages (the old release, or the spreadsheet import), copy them from the session.
5. Trigger `sessions_widen_session_dates` (AFTER INSERT OR UPDATE OF starts_at, ends_at, class_id): widen the parent's date range to cover the class's local days. It only widens, so a range the user typed is kept.
6. Function `buxa_delete_class(org, class)` (SECURITY DEFINER, as `buxa_delete_camp` in 0013): refuses a class with any enrolment (any status) with SQLSTATE 23503 and constraint `sessions_has_enrolments`; otherwise deletes the class. Request code keeps no DELETE grant.
7. Function `buxa_replace_class_instructors(org, class, person_ids[])` (SECURITY DEFINER): replaces a class's instructors. Request code keeps no DELETE grant on `session_instructors`.

0022 contains no `DROP` statement. The ratio columns stay in the database and the app stops writing them. `default_capacity` also stays. Both are candidates for a contract release.

## Old release during the deploy

- It inserts classes with no dates. The new app shows them as "dates not set" and asks for dates when they are edited.
- It inserts class rows with no name or ages. The trigger fills them in.
- New sessions have a NULL `default_capacity`. The old release's list parser expects a number, so the old classes list can fail to render those rows until the old release is gone. This is the one visible risk. Do not run the two releases side by side for long.
- Enrolments and capacity keep their rules; the capacity trigger is unchanged.

## Decisions for the owner to check

- The session's date range is typed in. A class's local days must fall inside it (the service checks this).
- Deleting a class is refused when it has any enrolment, cancelled ones included, so no enrolment history is lost.
- Editing a class can lower its camp size only down to the places already taken (the existing trigger).
