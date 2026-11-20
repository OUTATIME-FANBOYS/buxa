# Sample data

Buxa has two sets of sample data, and both are about **Camp Birchwood**, a fictional summer camp. Neither is real data. Never seed real people, real families or real accounts into either one.

## What each seed creates

**Database seed (`npm run seed:mock`)**, for the local Postgres database:

- the camp itself (`Camp Birchwood`, slug `camp-birchwood`), with four fictional staff accounts as members (owner, admin, staff, viewer)
- twelve families: guardians with households, pickup permissions and membership state, and their campers (birth dates, season passes, some lapsed or revoked)
- adults without a household: instructors, an organiser, admin staff and one participant
- season-pass memberships and badges (credentials) for campers and guardians, through the app's services, so the audit log records them
- a handful of check-ins: children and adults on site now, one child collected earlier today, and one closed visit from yesterday

It creates no tasks and no tickets. It also creates no sessions, classes, enrolments, registrations, seat holds or teacher accounts, so the registration and teacher screens are empty until they are used by hand. The owner is created with the camp. The admin, staff and viewer memberships are inserted straight into the membership table, because there is no invite flow yet.

**Browser demo (the staff board)**, stored in the browser only:

- the workspace `Camp Birchwood` with five staff-operations projects: Summer 2027 Registration, Facilities & Safety Prep, Staff Hiring & Training, Parent Communications, and Activities & Programme
- 55 tasks in those projects, with subtasks, comments and due dates
- five fictional staff users and a triage agent, with a little agent history

The board acts as the account you are signed in with. The browser seed's staff are fictional people in the board's data only; signing in never adds or changes them.
The browser seed lives in `apps/shared/src/kanban/seed/`. It is the only source of browser demo data.

## Sample persona accounts (later)

There are no browser-only accounts and no shared demo password. Sample accounts for each persona (director, registrar, operations, and so on) will come from a later seed step that creates real Supabase accounts, so they sign in like anyone else. That step is not built yet.

## Running the database seed

Point `DATABASE_URL` at the local database (see `docker-compose.yml`), then:

```sh
npm run seed:mock     # idempotent: does nothing if the camp already has people
npm run seed:reset    # deletes the camp's rows and seeds them again
```

`seed:reset` first prints what it will delete (people, households, memberships, badges and check-ins for the camp), then asks you to type `RESET`. The camp row, its members and the audit log are kept. In a run without a terminal, the reset is refused unless you add `--yes`:

```sh
npm run seed:reset -- --yes
```

Both commands refuse any database that is not on localhost (`localhost`, `127.0.0.1` or `::1`), including one named in a `host=` query parameter. They never print the connection string.

The flag `--reset` on `seed:mock` does the same as `seed:reset`.

## Resetting the browser demo

Open **Settings**, then **Your data**, and choose **Reset demo data**. After a confirmation, the browser's saved data is replaced with the Camp Birchwood sample from the browser seed. This changes only this browser's storage. It does not touch the database, and it does not remove anything you have not reset.

To keep a copy of your browser data first, use **Export JSON** on the same page.

## Rules for sample data

- Names, emails and addresses are invented. Emails use the reserved `example.com` domain.
- The database seed and the browser demo each have one source. Do not copy their data into other files.
- Do not seed real people, real accounts or real payment or health details, and do not use real credentials.
