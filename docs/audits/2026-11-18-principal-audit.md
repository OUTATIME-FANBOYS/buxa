# Principal engineering audit, 2026-11-18

Branch: `v0.3/chore/engineering-audit`. Read-only. No code was changed. Every finding is a suggested change for review.

**Brief used by every area:** the owner's audit prompt (overengineering, complexity, maintainability, performance, resource use, separation of concerns, state management, scalability; "do not refactor for the sake of refactoring"). **Skills applied:** `andrej-karpathy-skills:karpathy-guidelines` (surgical scope, stated assumptions, a check per finding), `jony-ive` (UI areas), `mattpocock-skills:codebase-design` (module, seam, adapter, deletion test). `mattpocock-skills:improve-codebase-architecture` is user-only and was not run.

Round 1 ran without the skills. Round 2 (this version) reran all eight areas with the skills. "Still valid" and "changed" refer to round 1.

## Status

| Area                                            | Status           |
| ----------------------------------------------- | ---------------- |
| Web components and separation of concerns       | Done (section 1) |
| Architecture and layering                       | Done (section 2) |
| State management and sync                       | Done (section 3) |
| Performance and resource use                    | Done (section 4) |
| Database, migrations and security-adjacent code | Done (section 5) |
| Styles and UI consistency                       | Done (section 6) |
| Domain, shared types and contracts              | Done (section 7) |
| Tests, tooling and CI                           | Done (section 8) |

---

## 1. Web components and separation of concerns

Ranked by impact.

1. **The selected project is kept in two places.** The client store and the URL both hold it, synced by effects. `views/kanban/BoardPage.tsx:27-41` calls `actions.selectProject` in an effect and resets the filter in a second one. `/camp/boards` redirects after mount and shows "Opening board..." in the meantime (`views/kanban/RoutePages.tsx:36-41`).
   - Suggested: take the project from the route parameter, reset the filter with `key={target.id}` on the board wrapper, and remove both effects.
   - Risk: medium, because store selection is used elsewhere.
2. **The Home page resolves the camp twice.** `app/(app)/camp/(work)/page.tsx:9-12` calls `requireSession` and `getCurrentCamp`, uses the result only for a null check, and then `loadHomeCamp()` calls `campContext()` again (`composers/camp/campHome.ts:23`).
   - Suggested: pass the resolved camp and session into `loadCampHome`, or have it return null.
   - Risk: low. The per-request cost is not measured.
3. **The two person-form legends are styled differently.** `NewPersonForm.tsx:61` uses `person-legend`, which `people.css:126` styles. `EditPersonForm`'s legend uses inline utilities, and its root has no `person-form` class, so the scoped rules never apply.
   - Suggested: add the root and legend classes, and drop the inline overrides.
   - Risk: none. The add and edit screens should look like one form.
4. **A memo has a suppressed dependency lint.** `components/components/kanban/board-views/ListView.tsx:54` suppresses `exhaustive-deps` on a sort that reads `userById` and `colName`, which are not in the dependency list, so the sort can go stale when members change. `RoutePages.tsx:41` has a bare `eslint-disable-line` with no rule name.
   - Suggested: add the dependencies or hoist the helpers, and name the rule.
   - Risk: low.
5. **A unit change is silent.** The 90-day range in `views/kanban/Reports.tsx:113-127` switches the chart to 13 weekly bars with no unit label, while the tile reads "Completed, 90 days".
   - Risk: low.

**Previous findings (round 1):**

- Reports view holds business rules (`Reports.tsx`, 249 lines): still valid.
- Overlay focus and keyboard logic repeated in `Popover.tsx:66-84`, `Dialog.tsx:99`, `Menu.tsx:144-158`: still valid.
- Prop drilling of `useStore()`, props passed 149 times: changed. Two prop passes and 28 `kindOf` mentions remain. Thirty-seven non-test files still call `useStore`.
- Duplicate person-form fields (`EditPersonForm.tsx:48-65`): still valid.
- Duplicate blob download (`History.tsx:41-47`, `Settings.tsx:63-66`): still valid, but the helpers moved to `views/attendance/exportDownload.ts` and `views/classes/errorReportDownload.ts`.
- Dialog-trigger pattern repeated (`AddPersonButton.tsx:13`, `NewClassButton.tsx:12`, `RenameCampButton.tsx:11`): still valid.
- Dead exports (`parseLocalDate`, `DonutSegment`, `SavedName`, `CampShellProps`, `formatDate`): still valid.
- Oversized files (`FilterBar` 273, `Menu` 267, `Reports` 249, `Dialog` 231 lines): still valid.
- Naming inconsistencies, `components/components/` split: still valid.

**Not read:** about 8 of roughly 60 route files in `app/`, including `app/v1/*`, `app/ready` and `app/health`. Dashboard, TaskDrawer, the camp and attendance component bodies, most board views. No type check, lint or browser check was run.

---

## 2. Architecture and layering

Ranked by impact.

1. **The shared barrel couples unrelated modules.** `apps/shared/src/index.ts:33-60` exports about 3,900 lines of kanban code and camp code together. 228 files import the barrel, against 79 that use subpaths.
   - Suggested: one subpath per module, or a separate kanban package.
   - Risk: high, because the sync and demo seed depend on it.
2. **Two error models.** `services/shared/errors.ts:12` (`guard`) throws `HttpError`. `classes/outcome.ts:46` (`attempt`) returns an `Outcome`. Composers need two translators.
   - Suggested: services throw typed errors, with one translator at the composer seam.
   - Risk: broad churn in tests.
3. **Two failure translators.** `composers/people/failures.ts:11` shows the service's 4xx message. `composers/camp/failures.ts:15` shows a fixed fallback and maps 409 to "address taken". The 403 string is also duplicated (`people/failures.ts:5`, `camp/failures.ts:23`).
   - Suggested: one translator with per-form overrides.
   - Risk: camp form copy changes.
4. **The camper-household rule lives in two places with different copy.** `composers/people/createPersonAction.ts:56-62` shows a field error. `services/people/createPeopleService.ts:131,143,155` throws `CAMPER_NEEDS_GUARDIAN`. `services/people/rules.ts:8` says no domain rule exists.
   - Suggested: move the rule into `packages/domain/src/people`.
   - Risk: medium. User-facing messages change.
5. **Camp-context logic is in three helpers.** `composers/people/camp.ts:6` (`currentActor`, throws), `composers/attendance/campActor.ts:7` (`campActor`, nullable), and `campZone` (`services/shared/views.ts:13`, `composers/attendance/campActor.ts:13`, `runtime.ts:136`).
   - Suggested: one camp seam, and one `campZone` function.
   - Risk: low.
6. **A dev-only kanban server sits inside the camp server package.** `apps/server/src/agents/` (`app.ts`, `mcp.ts`, `store.ts`) runs from the root `server` script and has its own JSON store. No camp file imports it. It imports `@buxa/shared/kanban/gateway`.
   - Suggested: move it to its own package or a tools folder.
   - Risk: script and test path changes.
7. **Two service trees.** `services/index.ts:8` re-exports `../classes/ClassService`, and `runtime.ts:135-143` wires classes separately, so the class code is split from the rest of the services.
   - Suggested: move `ClassService` and `ImportService` into `services/classes`.
   - Risk: import churn only.
8. **Two `Role` types.** `packages/domain/src/permissions.ts:7` (viewer, staff, admin, owner) and `apps/shared/src/kanban/types.ts:5` (owner, admin, member, viewer). The barrel re-exports the second, so a wrong import compiles silently.
   - Suggested: rename the kanban type.
   - Risk: low.
9. **Test doubles are re-exported from production barrels.** `classes/index.ts:2` and `people/index.ts` export the in-memory adapters. Keep both adapters, since they are two real implementations of the seam.
   - Suggested: change the re-export only.
   - Risk: low.
10. **Smaller findings.** `apps/server/src/unimplemented.ts` has no runtime caller. `apps/middleware/src/providers/AppProviders.tsx:10` is a single-child wrapper.

**Previous findings (round 1):**

- Two error models, two translators, camp-context helpers, camper rule, barrel and kanban persistence, two `Role` types: still valid.
- `unimplemented.ts` and `AppProviders.tsx`: still valid.
- `EnrolmentService.ts`: changed. It is a factory that binds the enrolment rule into `ClassService`, so it is low priority, not a pass-through.

**Preserve (passes the deletion test):** `MembershipService` (`createMembershipService.ts:8-55`). `createServices(repositories, clock)` at `runtime.ts:121` is a clean composition seam. Layering holds: no services import Pg adapters, `domain`, `db` and `contracts` have no reverse imports, and `shared` does not import server or db.

**Not read:** most of the roughly 40 composers, the attendance and credentials service bodies, Pg repository internals, `db` `tenant.ts` internals, the domain import plan, contract bodies, middleware hooks, kanban bodies, most of `agents/app.ts` and `mcp.ts`, the SQL migrations, and test bodies.

---

## 3. State management and sync

Ranked by impact. This area carries the most risk: several findings can lose user data.

1. **Replacing the whole state can erase server data.** `apps/shared/src/kanban/actions/data.ts:15,22` uses `replace = set(() => s)`. It is queued as a pending updater (`useStoreEngine.ts:76`) and replayed over server data on every adopt (`sync.ts:123`). Changes from an agent or another tab are dropped, and `flushNow` then saves the replaced state. Import checks only top-level arrays (`data.ts:12`) and overwrites `ui.theme` and the session.
   - Suggested: reset and import as versioned commands, with an explicit `resetting` phase.
   - Risk: silent data loss when Reset demo data or Import runs during agent activity.
2. **Impure updaters are replayed, and this can change ids.** `domain.ts:45,127` and `agents.ts:150,206,228` call `clock.id()` and `clock.now()` inside `set` updaters. The replay at `sync.ts:123` regenerates them, so a locally created task with id X can be stored as Y. `agents.ts:20-21` and `26-28` run `revertRun` and `simulateRun` twice.
   - Suggested: pass ids and timestamps in the command, so updaters are pure.
   - Risk: broken selection and duplicated agent runs. Not verified in the UI.
3. **Sync demotes itself permanently and drops edits.** `sync.ts:225-226` and `262-263` clear pending and switch to local mode when the health check or start fails, and `start()` never retries. `sync.ts:246` clears pending after the first-run PUT, so edits made during that wait are lost.
   - Suggested: a transition table, `connecting -> synced | offline(retryAt)`, with local mode only by the user's choice.
   - Risk: the browser and server diverge for the session.
4. **The sync retry loop can hammer the server.** `sync.ts:128-129` returns without adopting when the server is empty, and `sync.ts:165-168` recurses into `flushNow` with the same version, with no delay or cap.
   - Suggested: `flush: idle | sending | backoff(attempt)`, with a cap.
   - Risk: request flood if a 409 arrives with empty state. Verify with a test that returns 409 with empty state and asserts a bounded number of PUTs.
5. **The pre-sync backup is stale, and local edits are overwritten.** `sync.ts:252-253` writes `buxa.pre-sync` once and never clears it, so it holds the first snapshot ever taken. `sync.ts:258` adopts server data over local data when pending is empty.
   - Risk: silent loss of offline work, and a long-lived copy of user data.
6. **Unvalidated load, then overwrite.** `persistence.ts:30` casts parsed JSON, and `:31` checks only the version. `normalize.ts` does no shape check. Any failure falls back to demo data, and the next autosave overwrites the stored data.
   - Suggested: `Loaded = stored | quarantined(raw) | demo`, with no overwrite until the raw data is saved aside.
   - Risk: partly corrupt data becomes permanent demo data.
7. **The theme has three copies.** The store now listens for `THEME_EVENT` (`useStoreEngine.ts:39-50`, tested). But `useAppearance.ts:32-36` writes `THEME_KEY` and the DOM without dispatching it. It is used by `AccountMenu.tsx:25` and `AppearanceCard.tsx:24`, and the store then writes the stale value back (`persistence.ts:47`).
   - Suggested: one subscribable theme store, with `state.ui.theme` removed.
   - Risk: a dark-mode choice reverts after the next edit.
8. **Sign-out leaves local data behind.** `AccountMenu.tsx:72` posts only the server sign-out. Nothing removes `buxa.state.v1`, `buxa.theme` or `buxa.pre-sync`, so the next account on a shared browser sees the previous board.
   - Suggested: a sign-out transition that clears the local keys.
9. **Autosave can lose edits.** `useAutosave.ts:27` cancels its timer on unmount, and nothing flushes on `pagehide` or `beforeunload`.
   - Suggested: `SaveState = idle | dirty | saving | saved | failed`, with a flush on `pagehide`.
10. **A quota failure leaves edits in memory only.** `persistence.ts:46` can throw `QuotaExceeded`. `useAutosave.ts:22-23` then sets `error`, which stays until the next change, so a reload loses the work. (New in round 2.)
    - Suggested: `failed(retry)` with a visible prompt.
11. **Four status holders.** `SyncState` (`sync.ts:13`), `syncRef` (`useStoreEngine.ts:21`), `saveStatus` (`useAutosave`), and `AgentConnection` (`agentConnection.ts`, already a clean reducer). `sync.ts:198` reports "synced" on any version event, even with pending edits.
    - Suggested: one reducer for the sync phase, separate from save status.
12. **The sync machine is untested and opt-in.** `sync.ts:101` is gated on `NEXT_PUBLIC_LEGACY_SYNC`, which is off by default. Its roughly 290 lines have no tests for `flushNow`, `adopt` or `start`. (New in round 2.)
    - Suggested: add tests before changing it, or delete it if the local server is retired.
13. **A non-null assertion hides a null session.** `apps/shared/src/kanban/domain.ts:422` uses `s.session.userId!`, and `types.ts:152` allows null, so a workspace can get a null owner. Low risk: `WorkGate.tsx:14` gates the UI.

**Previous findings (round 1):** items 1 to 9 and 13 still valid. The theme item is changed: the store side is fixed, the `useAppearance` side is still open.

**Ruled out:** `theme-init.js`, `savedTheme` and `loadState` are wrapped in try blocks. The server PUT compares versions exactly, which is correct. `flushNow`'s count-based splice keeps edits made while a save is in flight.

**Not read:** `gateway.ts`, `cardDrag.ts` bodies, `useCheckIn` and `useCheckOut` reducers, `WorkProviders.tsx`, `AppearanceCard.tsx`, the server's sync and disk code, test bodies. No test suite was run.

---

## 4. Performance and resource use

Ranked by impact. Every effect is an estimate from code paths (round trips and transactions). No query plans, bundle analysis or load tests were run. Each finding lists the measurement that would prove the gain.

1. **N+1 pickup lookup per minor on site.** `services/attendance/createAttendanceService.ts:214` calls `pickupOptionsFor` inside the loop over on-site records, which runs household and collector reads per minor.
   - Measure: count statements per `onSite()` call with N minors through a wrapped pool. Expect about 1+N×(H+2) now, and about 3 after batching.
   - Suggested: one batched `household_members` query (`WHERE person_id = ANY`) and one `getMany`.
   - Risk: low. The tests cover it.
2. **N+1 in household listing.** `people/PgHouseholds.ts:61-63` and `:79-81` call `withMembers` per row. The People page loads this only for staff with add rights (`PeopleList.tsx:30`).
   - Measure: statements for `listHouseholds` with H households. Expect 1+H now, and 2 after.
   - Suggested: one `household_members` query with `WHERE household_id = ANY`, grouped in memory.
   - Risk: low.
3. **The Home page over-reads and fans out.** `composers/camp/campHome.ts:156-162` calls `listSessions` once per class, each with its own transaction and org read. `:30` loads the whole camp, with memberships, only to count it. `:82` re-reads the same visitor ids. The on-site visits are read twice (`createAttendanceService.ts:36-37`, `:187-191`). Home already runs its reads under `Promise.all`, so the cost is parallel fan-out, not a waterfall.
   - Measure: statements and pool waiting per Home request on a fixture with 20 classes.
   - Suggested: one query with `starts_at >= now() LIMIT 5`, one people count, and one reused visit read.
   - Risk: medium, because permission paths must not change.
4. **A write on every signed-in request.** `packages/db/migrations/0018_first_last_name_and_clock.sql:48-50` (`buxa_upsert_user`) always runs `DO UPDATE SET email`. It runs once per request, through `getSession`.
   - Measure: `n_tup_upd` on `users` before and after 100 sign-in requests. Expect 100 down to 0.
   - Suggested: `DO UPDATE ... WHERE users.email IS DISTINCT FROM EXCLUDED.email`, with a `SELECT` fallback, because `RETURNING` yields no row on a skipped update.
   - Risk: low to medium. Needs a new migration.
5. **A transaction per call.** `packages/db/src/tenant.ts:44-49` (`withOrg`) runs `SET LOCAL ROLE`, `set_config`, `BEGIN` and `COMMIT` for every repository method, about five extra round trips per read.
   - Measure: statements per request through a wrapped client.
   - Suggested: a request-scoped transaction per composer.
   - Risk: high, because it touches row-level security. Do not start here.
6. **The connection pool may be the limit under fan-out.** `config.ts:14` sets `DB_POOL_MAX` to 10, and `runtime.ts:69` sets `connectionTimeoutMillis` to 5,000. Each `withOrg` holds a client for the whole transaction, so Home's fan-out can queue for connections. (New in round 2, not measured.)
   - Measure: `pool.waitingCount` and `totalCount` during `loadCampHome` on a 20-class fixture.
   - Suggested: fix items 1, 3 and 5 first, then consider raising the cap.
7. **Some independent loads run one after another.** `views/classes/ClassPage.tsx:50, 54-55` and `PeopleList.tsx:27, 30` await `campClock`, enrolments, campers and the household list serially where there is no dependency. `loadClassPage` must stay first.
   - Measure: wall time with an artificial 50 ms per query.
   - Suggested: `Promise.all` for the independent loads.
   - Risk: low.
8. **People lists are unbounded.** `people/PgPersonQueries.ts:40-42` has an optional `LIMIT`, but `people.list` passes none (`PgPeopleRepository.ts:95`). `composers/attendance/loadAttendance.ts:11` loads the whole camp for a dropdown.
   - Measure: rows and bytes returned.
   - Risk: low to medium, because it changes the UI.
9. **The client bundle pulls in QR code generation.** `apps/shared/src/index.ts:69` re-exports `qr/svg`, which imports `qrcode-generator`. Client files import through this barrel (`CameraScanner.tsx:4`, `ScanField.tsx:13-14`, `BadgeCard.tsx:1`, `BadgeActions.tsx:7-9`).
   - Measure: `next build` with bundle analysis, comparing the chunk before and after.
   - Suggested: subpath imports such as `@buxa/shared/qr/svg`.
   - Risk: low. Size not measured.
10. **The store context re-renders everything.** `apps/middleware/src/providers/store.tsx:31` passes an unmemoized object to `StoreCtx`, so consumers of `campRole` and `archived` re-render on every store change.
    - Measure: React Profiler commit count per store change.
    - Suggested: `useMemo`. Risk: none.
11. **The camp row is read three or four times per Home request.** `campZone` (`services/shared/views.ts:13-15`) and `campClock` (`composers/attendance/campActor.ts:21`) each call `orgs.get`, which runs `count(*)` over `org_members` (`orgs/PgOrgRepository.ts:43`).
    - Measure: `EXPLAIN ANALYZE` of that statement.
    - Suggested: wrap `getCamp` in React `cache()`, as `getSession` already is.
    - Risk: low. Low absolute impact.
12. **The archived-camp list is read on every camp navigation.** `apps/web/actions/camp.ts:52` and `app/(app)/camp/(work)/layout.tsx:19`.
    - Measure: statements per navigation.
    - Suggested: cache the list, or load it only when the switcher opens.
    - Risk: low.

**Previous findings (round 1):** items 1, 2, 4, 5, 7, 8, 9, 10 and 11 still valid. Item 6 (serial waterfalls) is changed: narrowed, and not a waterfall on Home. Item 3 (Home fan-out) is still valid, with the parallel-fan-out framing.

**Ruled out:** the indexes on the hot predicates are present (the `household_members` primary key and person index, `session_instructors`, `sessions_org_class_idx`, `memberships_person_idx`, `check_ins_org_time_idx`, `credentials_one_active_idx`, `person_roles_org_role_idx`). No client component imports server code (97 files checked). `getSession` is cached per request. The on-site log is capped at 5,000 rows. The people search is a GET form, not a request per keystroke. Autosave is debounced at 250 ms. The `UiProvider` and `TaskDrawerProvider` values are memoized.

**Not read or not verified:** `classes.listSessions` and the rest of the classes service, the attendance repository's internals, the credentials, agents and import repositories, task-store internals in `apps/middleware`, most view internals, the startup-check caching in `runtime.ts`. No tests were run.

---

## 5. Database, migrations and security-adjacent code

Ranked by impact. Nothing was changed, and the live database and Supabase settings were not checked.

1. **High: a member rename writes no audit row, and changes a global user.** `packages/db/migrations/0016_member_rename.sql:7-15` takes no caller identity. `users.name` is global, so a rename in one camp shows in every other camp. Authorisation exists only in `composers/members/renameMemberAction.ts:33`, and that action writes no `audit_log` row.
   - Check: rename a member, then `SELECT count(*) FROM audit_log WHERE action LIKE 'member%'`. It returns 0.
   - Suggested: call `recordAudit` inside the same `withOrg` callback.
   - Risk: low. One call, same transaction, no schema change.
2. **High: any admin session can set `archived_at`.** `0013_camp_archive.sql:3-4` puts `archived_at` under the table-wide `GRANT SELECT, UPDATE ON orgs` (`0001_foundation.sql:82`). An admin can run `UPDATE orgs SET archived_at = now()` directly, with no owner check and no audit row. `buxa_archive_camp`, `buxa_unarchive_camp` and `buxa_delete_camp` (`0013:40`, `0017:11`, `0013:70`) also trust a passed actor id.
   - Check: `UPDATE orgs SET archived_at = now() WHERE id = current_org()` under a non-owner session returns rowCount 1.
   - Suggested: `REVOKE UPDATE ON orgs FROM buxa_app; GRANT UPDATE (name, timezone) ON orgs TO buxa_app;`. The only direct update, `PgOrgRepository.ts:64`, sets just those two columns. Add a non-owner test to `camp-archive.test.ts`.
   - Risk: low.
3. **Medium: definer functions trust a caller-supplied user id.** `buxa_memberships_of` (0009), `buxa_upsert_user`, `buxa_set_user_name` and `buxa_set_user_clock_format` (0018), `buxa_archive_camp`, `buxa_unarchive_camp`, `buxa_delete_camp` (0013, 0017), `buxa_rename_member` (0016). Row-level security does not apply to them.
   - Check: `SELECT * FROM buxa_memberships_of('<other user>')` under `withOrg(pool, null)` returns that user's camps.
   - Suggested: `withOrg` sets `app.user_id`, and the functions check it. A larger change; do it when the next definer function is added.
   - Risk: needs SQL injection or a new bug.
4. **Medium: security finding S-06 is still partly open.** `apps/server/src/config.ts:8-48` does not check `rolbypassrls` or `rolsuper`. `docs/deploy.md:55` says the migration login stays in use until the operator step.
   - Suggested: a check at `/ready`, but only after the operator step. Adding it now would fail production.
5. **Medium: migrations break the previous version during deploy.** `0018:55` drops `buxa_set_user_name(uuid, text)`, and `0020:5` drops `orgs.clock_format`. Both run before the new code serves (`scripts/vercel-build.ts:15-27`).
   - Suggested: expand first, contract a release later.
   - Risk: failed saves and sign-ins during each deploy.
6. **Medium-low: silent data loss.** `0018:9-12` truncates names to 60 characters with no count. `0020` drops the camp clock without copying a 12-hour setting to `users.clock_format`.
   - Suggested: copy before dropping, and assert zero truncations.
7. **Duplicate live functions.** `0013:22` `buxa_archived_camps_of` and `0014:6` `buxa_archived_memberships_of` run the same query.
   - Suggested: keep one.
8. **Lower.** `0010:50-51` revokes `rate_limit_hit` only from `PUBLIC`, while 0009, 0013 and 0014 also revoke from `anon` and `authenticated`. `narrow-privileges.test.ts:40-47` checks 3 of the 12 live definer functions.
   - Suggested: add a catalogue test for every `prosecdef` function. Also pin `search_path` to `''` with qualified names, and pin `current_org()`.

**Previous findings (round 1):**

- Rename (#1), archive bypass (#2), S-06 (#3), deploy break (#4), data loss (#5), narrow-privileges coverage, `search_path` and the capacity check in `0008:76-79`: still valid.
- Duplicate archived functions: still valid.
- "Dead versions remain" (`0009` `buxa_memberships_of` and `buxa_upsert_user`, `0015` `buxa_set_user_name`): changed. Later migrations replace or drop them, so only one version is live.
- Naming items (`org_role` enum, text plus CHECK columns, `rate_limit_hit` prefix): still valid.

**Open security audit items (checked in code):**

- S-04: fixed (`services/people/createPeopleService.ts:278`).
- S-06: partly open (item 4).
- S-09: open (`users/UserRepository.ts:8` unchanged).
- S-16: resolved in code. `services/shared/errors.ts:25-27` maps it to 404, so the status table is wrong.
- S-19: holds. `0006` revokes `org_members` writes from `buxa_app`.
- S-21: open (`app/(app)/camp/(operations)/attendance/export/route.ts:4` is a GET).
- vitest `^2.1.9`: open (`package.json:58`).

**Ruled out:** every table in 0001 to 0020 has forced row-level security (`users` and `rate_limits` by design). Every definer function pins its `search_path` and is revoked from `PUBLIC`. Migration numbering has no gaps. `audit_log` is append-only. The pinned Supabase CA is valid to 2031.

**Not read:** migrations 0002, 0006 to 0008, 0011, 0019 and the body of 0012, `updateName.pg.test.ts:9`, `docs/security.md`, `recordAudit`, the `/ready` route, test bodies (grep only), the token verifier, the legacy server, and the live database and Supabase settings. Migrations are forward-only, which is documented, so this was not counted as a defect.

---

## 6. Styles and UI consistency

Ranked by impact. All paths are under `apps/web`. Read-only; no screenshots were taken and no contrast values were checked. The Tailwind conversion for settings, signals, buttons-fields and popover styles has merged, so those are not reported as open.

1. **Button sizes and variants have sprawled.** `styles/components/button.css:133-141` defines `sm` (30px) and `header` (36px) sizes, and md is 44px. Overrides add more: `.att-btn-lg` 52px (`styles/features/attendance.css:8`, used in three TSX files), `.onsite-btn` 36px (`attendance.css:199`), `.camera-scanner .button` 48px (`styles/features/badge-scanner.css:78`), and `.chip` 32px (`styles/features/kanban/filters.css:36`). Naming is mixed: `button--sm` and `button--icon-only` use the plain prefix, but `buxa-button--header` (`Button.tsx:51`) does not. The `tertiary` and `outline` variants have no call sites outside tests.
   - Suggested: express `att-btn-lg` as a size, and delete the unused variants.
   - Risk: a visible change on the check-in and kiosk screens. `Button.test.tsx` checks variant classes.
2. **Two card systems.** `.card` is declared twice in `styles/features/kanban/board.css` (lines 69 and 96), and the second declaration overrides `cursor: pointer` with `cursor: grab`. `.project-card` (`styles/layout/pages.css:274`) has a different radius, padding and hover behaviour.
   - Suggested: one card class with variants.
   - Risk: the drag ghost depends on `.card-ghost` and `body.dragging-card` in `apps/shared/src/kanban/cardDrag.ts`.
3. **Two notice styles, one in the wrong file.** `.notice` (`styles/features/attendance.css:119`) is used by the shared `components/components/Notice.tsx:24` and by `scanner/CameraScanner.tsx:120`, so a shared component's style lives in a feature file. `.notice-box` (`styles/features/kanban/agents.css:197`) is used once, in `ConnectAgentDialog.tsx:29`.
   - Suggested: move `.notice` to `components/`, and delete `.notice-box`.
   - Risk: low.
4. **The owner role pill shares the AI agent colour.** `tokens.css:224-231` defines `tone-role-owner` with the same values as `tone-agent` (217-223). `tokens.css:9-13` says agent means AI activity, but the owner pill appears in `camp/MembersTable.tsx:29` and `people/RolePills.tsx:13`. (New in round 2.)
   - Suggested: give owner its own step. This is a decision for the owner.
   - Risk: a visible change on the Team page.
5. **Hand-written CSS remains: 31 files, about 4,170 lines.** The largest are `layout/pages.css`, `layout/shell.css`, `features/attendance.css` and `features/home.css`. `base.css` lines 110-186 are utility classes (`.row`, `.stack`, `.muted`, `.link`) and convert easily. `popover-menu-dialog.css` is 37 lines of keyframes only, so they can move into `tailwind.css` `@theme` and the file can be deleted. `index.css:14` still says the file holds popovers, menus and dialogs.
   - Risk: Tailwind is in a layer, so unlayered CSS beats it. Each converted rule must delete its old rule. `styles/mobile-layout.test.ts:24` and `auth-background.test.ts` assert literal CSS text and will break.
6. **Font sizes are off the scale.** The tokens are 12, 14, 22 and 28px (`tokens.css:99-102`). There are 35 literal `font-size` declarations, for example 10px (`shell.css:266`), 11px (`charts.css:12`, `base.css:159`), 13px (`charts.css:45`, `help.css:75`), 15px (`pages.css:335`), 18px (`attendance.css:51, 278`). Keep the 16px inputs (`responsive.css:97`), which iOS needs to avoid zooming.
   - Suggested: map each to a token. Literals that already equal a token (14px and 28px at `attendance.css:102, 203` and `help.css:39`) can be swapped now.
7. **Spacing and radii are off the scale.** About 38 spacing declarations are off the scale, for example 2px at `board.css:66` and 34px at `shell.css:172`. There are 27 radius literals, for example 2px at `board.css:33`, 3px at `home.css:112`, and 10px at `pages.css:263`. Literals that equal a token (6, 8 and 12px at `shell.css:39, 263, 344` and `filters.css:71`) can be swapped now.
   - Risk: shifts of 1 to 3px for the off-scale values.
8. **`!important` hides specificity fights.** There are 7 declarations: five in `responsive.css` (reduced motion, needed because `.button:active` at `button.css:109` has specificity 0,3,0), one in `board.css:129` (cursor grabbing) and one in `people.css:196` (print). Matching the selector would remove the need. `fieldDefaults.ts:19-20` uses the `!` suffix twice.
   - Risk: changing the cascade needs visual checks.
9. **Dead selectors.** These have no exact class match in components, app or views: `.c-act` (`table.css:69`), `.span-2` (`responsive.css:126`), `.crumb-sep` (`shell.css:129`), `.home-count` (`pages.css:118`), `.pickup-choices` (`attendance.css:220`), `.scan-label` (`badge-scanner.css:43`).
   - Risk: none. Grep again before deleting.
10. **HeroUI is a vestige.** It is not in `package.json`, the lock file or any import, but `heroui-theme.css` still exists. Thirteen of its variables have no reader, for example `--default`, `--background` and `--surface-secondary`. `button.css:2` names the old path `components/elements/Button.tsx`; the real file is `components/atoms/Button/Button.tsx`.
    - Suggested: delete the unused variables and fix the comments.
11. **A control-height token is contradicted.** `--control-compact` is now used deliberately (`classes.css:66`, `people.css:112`), but the comment at `tokens.css:103` still says "one height for all controls".
    - Suggested: fix the comment.
12. **Duplicate values and unused tokens.** `tokens.css:232-245` repeats the warn and ok values for admin and staff. `--coral` equals `--f-crit`, and `--on-coral` equals `--on-fill` (`tokens.css:62-64`). `tone-hero` and `pill-hero` (`tokens.css:268-275`), the `hero` member in `apps/shared/src/tones.ts:2`, and `--role-teacher` and `--role-teacher-soft` (`tokens.css:57-58, 152-153`) have no users.
    - Suggested: point duplicates at the existing tones and delete the unused tokens, or keep the teacher pair with a comment.
    - Risk: none.
13. **Colour literals that should be tokens.** The scrim `rgba` in `components/Dialog.tsx:11` and `responsive.css:41` is duplicated, and `filters.css:129` uses `rgba` instead of `--shadow-1`. The `BrandMark` colour is now read from `var(--accent)` (`shell.css:349-352`), so dark mode works. `BadgeCard`'s `#fff` and `#000` are QR code colours and should stay.

**Previous findings (round 1):** button sprawl, card systems, notices, font sizes, spacing and radii, `!important`, dead selectors, HeroUI vestige: still valid. Hand-written CSS: changed, now 31 files and about 4,170 lines (was 33 and about 4,370). Control height: changed, now deliberate but mis-commented. Colour literals: partly resolved.

**Not read in full:** the feature and layout CSS files (checked by grep), the test files, the TSX beyond the cited lines. No screenshots or contrast checks were taken, and the app and tests were not run.

---

## 7. Domain, shared types and contracts

Ranked by impact. Read-only and grep-based. No `tsc` or knip run. Dead-export counts are word matches, so names used only inside their own file are not flagged.

1. **Two `Role` types in one barrel.** `apps/shared/src/kanban/types.ts:5` defines `Role` (owner, admin, member, viewer), along with `User`, `Member` and `Workspace`. These are exported through the `apps/shared` barrel (`index.ts:60`), and 41 files import them. The domain `Role` (viewer, staff, admin, owner) is in `packages/domain/src/permissions.ts:7`.
   - Suggested: rename or namespace the kanban types, or delete them if the kanban board is retired.
   - Risk: medium, because of wide import churn.
2. **Camp roles map to pill tones in two places, and one is untyped.** `ROLE_TONE` in `apps/shared/src/tones.ts:6` is typed `Record<Role, RoleTone>`, and `apps/shared/src/camp/abilities.ts:21` also maps roles to tones. `CAMP_ROLE_TONE` is not typed, so a new role still compiles. `RolePills.tsx:13`'s `?? 'neutral'` fallback is dead.
   - Suggested: one typed map.
   - Risk: low.
3. **One membership status, two colours and labels.** `apps/shared/src/people/status.ts:5-19` maps expired to warn and revoked to crit. `apps/shared/src/attendance/status.ts:8-13` maps expired to crit and revoked to neutral. Both are used, by `people/AccessPill.tsx` and `attendance/StatusPill.tsx`.
   - Suggested: one map keyed on `AccessStatus`.
   - Risk: a visible change. The status and view tests need updating.
4. **The capacity rule is written in the UI, and the domain helper has no caller.** `apps/web/components/components/classes/SessionStatus.tsx:7` computes "left" itself, and `views/classes/ClassPage.tsx:144` uses `>=`. `packages/domain/src/classes/capacity.ts:8` (`seatsLeft`) has no non-test caller.
   - Suggested: use `seatFor` and `seatsLeft`.
   - Risk: low.
5. **Refusal text ignores the 12- or 24-hour choice.** `packages/domain/src/classes/refusals.ts:15-17` hard-codes `hour12: false`, and `describeRefusal` takes only a time zone (called from `apps/server/src/classes/outcome.ts:58`). `apps/shared/src/time.ts` does honour the choice.
   - Suggested: pass the clock format through.
   - Risk: wording changes for 12-hour users.
6. **Camp date and time-zone logic is copied, and a domain rule lives in the server.** `zoneOffsetMs` is in `packages/domain/src/classes/import/campTime.ts:12` and `apps/server/src/services/shared/campDay.ts:15`. `localDayStart` and `localDaysWindow` (`campDay.ts:42-57`) belong in domain. The calendar-step helpers are copied too: `daysBefore` (`composers/camp/campHome.ts:74`), `nextLocalDay` (`campDay.ts:8`) and the device-zone `addDays` (`apps/shared/src/dates.ts:10`).
   - Suggested: move them to `packages/domain/src/people/localDate.ts`.
   - Risk: medium, because attendance windows depend on them.
7. **Two UUID checks disagree.** `packages/domain/src/ids.ts:1-4` accepts any hex in the 8-4-4-4-12 form, yet its comment calls it the single definition. The 16 uses of `z.string().uuid()` in non-test contracts (for example `contracts/src/classes.ts:113-114`, `people.ts:89`) run zod 4.6.7's check, which requires a version 1 to 8 UUID and an RFC variant. So `00000000-0000-0000-0000-000000000001` passes `isUuid` and fails zod.
   - Suggested: one definition.
   - Risk: pages and actions disagree on seed or test ids.
8. **Response schemas are never enforced.** `packages/contracts/src/index.ts:3-5` says the client validates responses. No production code parses `MeSchema`, `OrgSchema`, `MembersSchema`, `ArchivedCampsSchema`, `PersonSchema`, `ClassSchema`, `SessionSchema`, `EnrolmentSchema` or `ErrorBodySchema`. Only `apps/web/__tests__/integration/routes.test.ts` uses them.
   - Suggested: correct the comment, or parse at the boundary.
   - Risk: low.
9. **Role and status literals are copied by hand.** `contracts/src/index.ts:126` hard-codes the archived-camp role enum instead of using `ROLES`. `apps/web/actions/camp.ts:25-36` re-declares `ArchivedCamp` and `CampActionResult`. `contracts/src/people.ts:8` (`AccessStatusSchema`) differs from the four-value membership enum at `people.ts:21`. `apps/server/src/agents/mcp.ts:14, 95, 156` copies priority, kind and status literals. `apps/shared/src/kanban/agents.ts:19` leaves `PROPOSAL_KINDS` untyped. The `'24h'` default appears at `composers/attendance/campActor.ts:24`, `TimeFormatCard.tsx:37` and `AccountMenu.tsx:28`, but `DEFAULT_CLOCK_FORMAT` has no production caller.
   - Risk: low.
10. **Domain rules sit in composers and UI.** `apps/server/src/composers/camp/campHome.ts:128-145` buckets statuses, folding revoked into none. `services/people/rules.ts:13` (`isGuardianRole`) has a comment that admits no domain rule exists. `apps/shared/src/attendance/checkOutInput.ts:8-14` repeats the minor rule from `decideCheckOut`. `components/components/camp/ArchivedCampsCard.tsx:56` and `views/kanban/Agents.tsx:28` check the owner or admin role inline.
    - Risk: medium.
11. **Exports with no non-test caller.** In domain: `seatsLeft`, `isClockFormat`, `DEFAULT_CLOCK_FORMAT` (test fakes only). In shared: `localTimeZone` (`NewCampForm.tsx:28` re-implements it), `qrSvg`, `abilitiesFor`, `soonDate`, `taskCounts`, `taskSummary`, `isCampPath`, `formatSummary`.
    - Risk: none, but check with knip first, since dynamic imports are not visible to grep.
12. **Duplicate tone definitions.** `apps/web/components/elements/chartTone.ts:1` duplicates `Tone`. `'hero'` in `apps/shared/src/tones.ts:2` has no TypeScript use.

**Previous findings (round 1):** all ten still hold, with the counts corrected: the `.uuid()` calls number 16 in non-test code, not 32.

**Ruled out:** the membership, permission and check-in and check-out decisions read as correct. `permissions.ts`'s `authorize` fails closed. `qrPath` is used.

**Not read:** most of `audit.ts`, `slug.ts`, `classes/ageRange`, `ratio`, `interval`, `import/plan.ts`, `credential.ts`; kanban agents, gateway and sync bodies; attendance logic beyond its types; server composer bodies (spot checks only); web components beyond grep; `packages/db`; test bodies.

---

## 8. Tests, tooling and CI

Ranked by impact. Read-only: static reads, plus `eslint` and `prettier --check`. Vitest, `next build` and the Vercel build were not run.

1. **The production build path never runs in CI.** `apps/web/vercel.json:4` runs `scripts/vercel-build.ts`, which applies migrations on production builds (`scripts/vercel-build.ts:15-32`). CI's build job runs `npm run build` (`ci.yml:246`). Nothing in the code references `vercel-build` outside the docs. The only code that changes the production schema is code CI never executes.
   - Suggested: run `npx tsx scripts/vercel-build.ts` in the build job, and once in the database job with `VERCEL_ENV=production` against the test database.
   - Risk: extra CI minutes. A migration failure would block PRs, which is the intent.
2. **Web routes are not exercised at runtime.** There are 27 pages and 9 route handlers. The in-process harness hand-lists 6 handlers (`apps/web/__tests__/integration/harness.ts:4-9`). The route at `app/(app)/camp/(operations)/classes/import/template/route.ts` is not imported by any test. `next build` only compiles and prerenders static pages, so a 500 on a real page passes today.
   - Suggested: a smoke step that runs `next start` and requests every route, expecting no 5xx. Build the list from the filesystem.
   - Risk: needs env vars and a port, and may be flaky.
3. **Migrations are tested only on an empty database.** `ci.yml:208-211` runs `db:migrate` on a fresh Postgres. Migrations 0018 to 0020 change existing data, and no test seeds rows before them.
   - Suggested: one test that applies 0001 to 0017, inserts rows, then applies the rest.
   - Risk: a slower database job.
4. **About 620 assertions test markup, and eight files test source text.** `apps/web/styles/mobile-layout.test.ts` asserts exact CSS declarations. `apps/web/components/components/kanban/__tests__/FilterBar.test.tsx:67,69` asserts CSS text. `apps/web/config/theme.test.ts` reads `public/theme-init.js`. `test/eslint-config.test.ts:11` asserts that the config file contains a string. These break on reformatting, not on behaviour.
   - Suggested: delete `eslint-config.test.ts`, since the lint job enforces the rule. Move the layout checks to a viewport check in a browser run.
   - Risk: losing layout regression coverage until the replacement exists.
5. **The unit and database split lives in two lists.** `package.json:14-15` (`test:unit` excludes, `test:db` filters) must match by filename. They match today. A new database test with another name would be silently skipped in unit and never run in CI.
   - Suggested: one guard test that every `skipIf(!url)` file matches the database pattern.
   - Risk: none.
6. **Local `npm run lint` fails on generated output.** `eslint.config.mjs:34-43` does not ignore `.vercel/`, which gives 6,683 local errors, almost all `padding-line-between-statements`. Source only, with `--ignore-pattern '.vercel/**'`, gives 0 errors and 65 warnings. `.vercel` is git-ignored, so CI is not affected.
   - Suggested: add `'.vercel/**'` to the ignores.
   - Risk: none.
7. **A debt comment is stale.** `eslint.config.mjs:84` says 77 `!` assertions; the current count is 23 warnings. The 41 `require-await` warnings are not documented.
   - Suggested: update the comment. Low.
8. **CI setup is repeated in five jobs.** The setup-node and cache-restore block appears at `ci.yml:128-135, 144-151, 165-172, 200-207, 238-245`.
   - Suggested: a composite action. Cosmetic, low risk.
9. **Doc-only PRs skip Prettier.** `classify-changes.sh:19` routes `*.md` to unit only, and `format:check` runs only in the lint job. Low.

**Working well:** the change classifier has its own tests (`test-classify-changes.sh`). The database job runs as a non-superuser (`ci.yml:216-223`). Migration numbering and privilege tests exist. The verify job gates correctly.

**Previous findings (round 1):** this area had no earlier section, so all items are new.

**Not read:** most of the roughly 1,870 test cases, component tests beyond grep, server and domain test bodies, `scripts/seed-mock` and timing tests, the rest of `test/architecture` and `test/flows`.

---

## Next steps

- Review the suggested changes, then decide which to take. Each finding is a candidate, not a decision.
- Owner decisions needed: the owner role colour (section 6, item 4), whether the kanban board and the kanban dev server are retired (sections 2 and 3, and 7), and whether to run `improve-codebase-architecture`.
- Highest-impact fixes to consider first: the member-rename audit row and the archive-permission grant (section 5, items 1 and 2), the sync data-loss items (section 3, items 1, 3 and 5), and the production migration path in CI (section 8, item 1).
