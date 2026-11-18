# Phase 1 check-in timing: evidence and the phone procedure

Exit criterion (from `docs/ROADMAP.md`, phase 1): **staff check in a member in under 5 seconds on a phone (iOS Safari and Android Chrome).**
This page holds the evidence for it. It has two halves: a server-side guard that runs in the test suite, and a manual measurement on real phones that only the owner can do.

## Budgets

| Budget            | Value                                                                                          | Where it is enforced                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Phone budget**  | 5 seconds from the scan to the green result, on a real phone, on iOS Safari and Android Chrome | Manual, procedure below                                                                   |
| **Server budget** | p95 under **1000 ms** for the server side of a scan followed by a check-in                     | `SERVER_P95_BUDGET_MS` in `apps/server/src/attendance/__tests__/checkInTiming.pg.test.ts` |

The server budget is **not the phone budget**. It is a regression guard on the database and the services. The 5 seconds on the phone also includes the network, the phone itself, the browser, and the staff member's taps. The server's share has to stay well inside it, so a slow query fails the build before a phone ever sees it.

## What the automated measurement covers

`checkInTiming.pg.test.ts` runs against the real Postgres database (row-level security on, the same `migrate` and fixtures as the other `*.pg.test.ts` files):

1. Creates a camp with **300 people**. Each one is created through `services.people.create`, given a valid membership through `services.memberships.add`, and given a badge through `services.credentials.issue`.
2. Checks in **50 people** first, so the on-site list the scan reads is not empty.
3. For **100 members** (each is timed once):
   - **scan**: `services.credentials.scan` with the badge payload, then `services.attendance.onSite`. This is the work `scanCodeAction` does.
   - **check-in**: `services.attendance.checkIn`. This is the work `checkInAction` does.
   - the check-out that follows is not timed. It keeps the state clean for the next visit.
4. Reports p50, p95 and max for the scan, the check-in, and the whole scan-to-check-in response. It asserts the p95 of the whole response is under the server budget.

The Server Action wrapper (session lookup, the rate limiter, the input check) is **not** included. Those add a little time on top of these numbers, and the phone measurement captures them.

Unit tests cover the helpers in `scripts/timing/`: `targetUrl.test.ts` (the localhost guard), `options.test.ts` (argument checks) and `actionId.test.ts` (finding the scan action's id).

### How to run it

```bash
export DATABASE_URL=<the Postgres URL for your local database, as set up in docker-compose.yml>   # never commit it
npx vitest run apps/server/src/attendance/__tests__/checkInTiming.pg.test.ts
```

The test prints the numbers. Without `DATABASE_URL` it is skipped, as the other Postgres tests are.

## Results on the server (this machine)

Machine: a Mac (Darwin 27) running the Node test process, with the local Postgres 16 from `docker-compose.yml` in Docker. Times are in milliseconds, for 100 timed visits.

| Run | Conditions                                           | Scan p50 / p95 / max | Check-in p50 / p95 / max | Scan to check-in response p50 / **p95** / max |
| --- | ---------------------------------------------------- | -------------------- | ------------------------ | --------------------------------------------- |
| 1   | this file alone                                      | 17.4 / 48.7 / 207.3  | 12.8 / 38.0 / 143.4      | 30.4 / **84.6** / 315.6                       |
| 2   | full `npm test` run (other suites in parallel)       | 33.5 / 75.3 / 90.3   | 23.1 / 62.1 / 119.3      | 58.7 / **129.6** / 152.7                      |
| 3   | this file alone (slower run, cause not investigated) | 92.4 / 185.4 / 245.8 | 68.5 / 140.7 / 160.9     | 178.3 / **285.0** / 361.2                     |
| 4   | this file alone                                      | 17.6 / 30.0 / 67.9   | 13.2 / 25.4 / 58.5       | 31.6 / **59.7** / 93.9                        |

**Headline:** across the four runs the server's p95 for scan plus check-in was between 60 and 285 ms, and the slowest single visit was 361 ms. That is well under the 1000 ms server budget. Expect the numbers to move from run to run on a laptop; the guard is the p95 threshold, not any one run.

These are server numbers only. They say nothing about the phone.

## Measuring on a real phone (for the owner)

This is the evidence the exit criterion needs. It has to be done on **real devices**, not a simulator or the desktop browser.

### Before you start

- **Install step:** the installable staff app (PWA) is on `develop` and built (`/manifest.webmanifest`; see `docs/ROADMAP.md`, "Staff mobile app"). Run each phone once in the browser and record `browser` in the table's _Install_ column. Then install the app from the home screen and repeat the run, recording `home screen`.
- Use a **production build** on a **staging URL** (the same build as `npm run build` and `npm run start`), never `next dev`.
- You need one **test badge**: a test person (not a real member) with a membership valid today and a badge printed or shown on a second screen. Archive or revoke that person afterwards. Do not use a real child's badge.
- Turn off battery saver and low-power mode. Keep the phone on Wi-Fi or a normal mobile connection, and write down which one.
- Have a second person or a screen recording to time the run. Screen recording is more accurate than a stopwatch.

### Steps (for each phone: one iPhone on Safari, one Android on Chrome)

1. Install the app from the phone's home screen (open the staging URL in the browser first if the install prompt is not offered).
2. Sign in as a staff member with the `staff` role or higher.
3. Open **Check in** (`/camp/check-in`).
4. Start the screen recording, or the stopwatch, on the moment the badge is held up to the camera or the moment the code is typed or scanned.
5. Scan the test badge with the camera button, or with a handheld scanner into the scan field.
6. Stop the timer on the first frame where the **green valid result card** for the test person is fully on screen (name, and the green "Valid" status with its words).
7. Write the time down in the table. Clear the result (the clear button, or check the person in, after which the screen clears itself) and repeat from step 4.
8. Do 10 runs on each phone. Do not skip a run that was slow. If a run fails (no card, a red result, or a network error), write it down as a failure in the notes, do not drop it, and repeat it at the end.
9. Calculate the **median** of the 10 times (the middle value when sorted; average the two middle values if you have an even count). The phone passes if the median is under 5 seconds **and** no run is over 5 seconds on the day. Report any run over 5 seconds with its cause.

Optional, for the check-in itself: after the green card, tap **Check in** and time the tap to the confirmation in a second column. This is not part of the exit criterion, but it shows the staff member's full cost.

### Results (fill in; leave blank until measured)

The phone tables below are blank on purpose. They are for the owner to fill in on real devices; nobody else should write results into them. The server numbers above are not a substitute for them.

Median is over the 10 runs of each phone. The median goes in the "Median" row, and the PASS/FAIL line is set from it.

**iOS Safari**

| Phone and iOS version | Network | Install (browser / home screen) | Run | Scan to green result (s) | Notes |
| --------------------- | ------- | ------------------------------- | --- | ------------------------ | ----- |
|                       |         |                                 | 1   |                          |       |
|                       |         |                                 | 2   |                          |       |
|                       |         |                                 | 3   |                          |       |
|                       |         |                                 | 4   |                          |       |
|                       |         |                                 | 5   |                          |       |
|                       |         |                                 | 6   |                          |       |
|                       |         |                                 | 7   |                          |       |
|                       |         |                                 | 8   |                          |       |
|                       |         |                                 | 9   |                          |       |
|                       |         |                                 | 10  |                          |       |
| **Median**            |         |                                 |     |                          |       |

Result: ______ (PASS if the median is under 5 s and no run was over 5 s).

**Android Chrome**

| Phone and Android version | Network | Install (browser / home screen) | Run | Scan to green result (s) | Notes |
| ------------------------- | ------- | ------------------------------- | --- | ------------------------ | ----- |
|                           |         |                                 | 1   |                          |       |
|                           |         |                                 | 2   |                          |       |
|                           |         |                                 | 3   |                          |       |
|                           |         |                                 | 4   |                          |       |
|                           |         |                                 | 5   |                          |       |
|                           |         |                                 | 6   |                          |       |
|                           |         |                                 | 7   |                          |       |
|                           |         |                                 | 8   |                          |       |
|                           |         |                                 | 9   |                          |       |
|                           |         |                                 | 10  |                          |       |
| **Median**                |         |                                 |     |                          |       |

Result: ______ (PASS if the median is under 5 s and no run was over 5 s).

## Measuring from a browser with a script

`scripts/measure-checkin.ts` (`npm run measure:checkin`) sends the scan request the check-in screen sends and prints p50, p95 and max. It is for a desktop or a laptop on the same network as the site. It does **not** replace the phone run, because it skips the phone and the camera.

```bash
# A local production build (npm run build && npm run start, then open the site once in a browser and sign in)
npm run measure:checkin -- --url=http://localhost:3000 --token=bx1.<test badge> --runs=10

# A deployed site: refused unless --allow-remote is given
BUXA_SESSION_COOKIE='<Cookie header from a signed-in staff browser>' \
  npm run measure:checkin -- --url=https://staging.example.org --token=bx1.<test badge> --allow-remote
```

- The token is a **test badge**. Never use a real member's badge. The script only scans, so it does not check anyone in or out.
- The token and the session cookie are not printed. The cookie comes from the environment variable, so it stays out of the command shown in the shell history.
- For a host other than localhost, `--allow-remote` is required, and the script says so if you forget it.
- If the script cannot find the scan action in the page's scripts, pass the action id from the build with `--action-id=<hex>`.
- Status: the script's argument checks and its localhost guard are unit tested. An end-to-end run needs the Supabase settings and a signed-in session, which were not available when this was written, so the script is not yet measured against a running site. Record its numbers here once it has been run.

## Still open

- The phone results table is blank. The phase exit criterion is not met until the owner fills it in with a passing median on both phones.
- The install check on real phones is still open. The manifest and the install hint are built.
- The browser script has not been run end to end against a signed-in site.
