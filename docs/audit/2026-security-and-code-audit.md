# 2026 security and code audit

- **Audited commit:** `a9dc389` (origin/develop at the time of the audit)
- **Date:** 2026-11-16
- **Scope:** the camp management site (Next.js 16, Postgres with forced row-level security, Supabase Auth), read-only. No application code, tests or configuration were changed.
- **Method:** source reading of the files listed under "Method" at the end, targeted grep, `npm ci`, `npm audit`, and one run of the test suite against the local database.

This is a snapshot. The findings, line numbers and test counts below describe `a9dc389`. The status table shows what changed on `develop` after that, checked by reading the code on the `v0.1.1` docs branch. Re-check a row before relying on it.

## Status on develop

| ID | Status | Where it stands now |
|---|---|---|
| S-01 | Fixed | The check-out update has `AND checked_out_at IS NULL` (`apps/web/server/attendance/PgCheckInWrites.ts`). |
| S-02 | Fixed | Viewers no longer hold `attendance:read` (`packages/domain/src/permissions.ts`). |
| S-03 | Fixed | Custody fields (memberships, pickup flags, badge status) are shown only with `people:read_contact` (`createPeopleService.ts`). |
| S-04 | Open | `people:authorise_pickup` exists in the matrix, but `linkToHousehold` in `createPeopleService.ts` does not check it. |
| S-05 | Fixed | Pages and the sign-in action check the start-up decision (`isServiceRefused`, `/maintenance`). |
| S-06 | Partly | Request handling runs as `buxa_app`, and the privileged paths are `SECURITY DEFINER` functions (migration `0009`). The separate runtime login is an operator step in `docs/deploy.md`, not yet done. |
| S-07 | Fixed | Rate limits on camp creation, badge scans and `/ready`, kept in Postgres (migration `0010`). |
| S-08 | Fixed | `listMembers` returns email only to actors with `members:read_contact` (`apps/web/server/services/orgs.ts`). |
| S-09 | Open | The conflict message in `apps/web/server/users/UserRepository.ts` is unchanged. |
| S-10 | Fixed | "Already registered" gets the same message as a new sign-up (`apps/web/features/auth/lib/messages.ts`). |
| S-11 | Fixed | `readBody` counts bytes as they arrive (`apps/web/server/http/parse.ts`). |
| S-12 | Fixed | Email and phone shapes are checked in `packages/contracts` (`contact.ts`). |
| S-13 | Fixed | A failed rollback releases the connection with an error, so it is destroyed (`packages/db/src/tenant.ts`). |
| S-14 | Partly | A non-loopback host is refused unless `BUXA_ALLOW_REMOTE_HOST=yes`, and `/api` needs a run secret (`X-Buxa-Run-Secret`). Dev server only. |
| S-15 | Fixed | A unique violation on reissue becomes `BadgeConflictError` (`PgCredentialRepository.ts`). |
| S-16 | Open | `OrgNotFoundError` is still not translated to a 404. |
| S-17 | Fixed | `next.config.ts` sets `nosniff` on static files and the icon. |
| S-18 | Fixed | The demo sign-in form and its password are no longer in the auth code. |
| S-19 | Unchanged | No role-management routes exist yet. |
| S-20 | Unchanged | Logging is as described in the body. |
| S-21 | Unchanged | The CSV export is still a GET. |
| Deps | Open | `vitest` is `^2.1.9` on `develop`; the section 3 upgrade has not been applied. |

## 1. Summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | |
| High | 0 | |
| Medium | 7 | S-01 to S-07 |
| Low | 9 | S-08 to S-16 |
| Info | 5 | S-17 to S-21 |

**Verdict:** the security model is sound at its core (tenant isolation, token verification, badge storage, server-side permission checks). It is still **not ready for real children's data**, which agrees with `docs/security.md`. The seven medium findings are the blockers. Four of them (S-02 to S-04, S-06) concern who can see or change child data and custody records, and should be settled before the next deploy.

**Tests:** `npm test` passes: 92 test files passed and 1 skipped, 863 tests passed and 1 skipped. The Postgres tests ran against `localhost:5433` (they were not skipped). The one skipped test is `packages/db/test/ci-guard.test.ts`, which runs only when `CI` is set.

**Dependencies:** production dependencies have 0 known vulnerabilities. The full tree has 6 (2 critical, 1 high, 3 moderate), all in dev and test tooling (vitest, vite, tinypool, esbuild, vite-node). The fix is vitest 5.x, which is a major upgrade and was not applied.

### Top ten things to fix first

1. **S-02 and S-03:** decide what viewers may see. Today a viewer can read child attendance logs and on-site lists, resolve any badge to a child, and see household pickup flags, memberships and revocation reasons. Remove these from the viewer role, or return names only.
2. **S-04:** give pickup authorisation its own permission (admin and above). Today any staff member can authorise a stranger to collect a child.
3. **S-01:** make the check-out update conditional (`AND checked_out_at IS NULL`) and check the row count. Overlapping check-outs can currently overwrite the record of who collected a child.
4. **S-05:** enforce the "email confirmation required" startup decision for pages and server actions, not only `/v1` routes. Otherwise the documented control does not hold.
5. **S-06:** run the request handling as a login role that cannot bypass row-level security. Move the two privileged paths (user upsert and org creation) into narrow functions. Correct `docs/security.md` section 2, which overstates the current least privilege.
6. **S-07:** rate-limit `POST /v1/orgs`, `createCampAction`, `scanCodeAction` and `/ready` (the open item in `docs/auth.md` and `docs/security.md`).
7. **S-12:** validate email and phone format in the contracts, and map Postgres check violations to a 400 instead of a 500.
8. **S-08:** do not return staff email addresses to viewers in `listMembers`.
9. **S-11:** enforce the body-size limit while reading the body, not only from the `Content-Length` header.
10. **S-10 and S-09:** check Supabase's sign-up response for an existing address, and make the sign-up and conflict messages uniform.

### What is already done well (do not change without reason)

- **Permission matrix, fail-closed.** `packages/domain/src/permissions.ts` `authorize()` denies unknown roles, other organisations and missing context. Every service starts with `assertAllowed` (`apps/web/server/auth/authorize.ts`). The UI uses the same function only to hide controls.
- **Token verification.** `apps/web/server/auth/verifier.ts:20-29` accepts only ES256 and RS256, checks issuer, audience and expiry, and requires a UUID `sub`. Users are linked by the provider id (`PgUserRepository.ts:17-18`), never by email. `none` and shared-secret tokens are rejected.
- **Cookie sessions.** Every cookie goes through `hardenCookie` (`apps/web/server/session/cookies.ts:7-9`): HttpOnly, SameSite=Lax, `Secure` in production, path `/`. Server actions are the only mutation path for the browser, and Next.js checks their Origin. `/v1` accepts bearer tokens only, so cookies never authenticate the REST API.
- **Row-level security.** Every tenant table has `ENABLE` and `FORCE` row-level security and an `org_id = current_org()` policy (migrations 0001 and 0007). A catalogue test checks forced RLS (`packages/db/test/audit-and-catalog.test.ts:15`). Composite foreign keys `(org_id, id)` block cross-camp references (0007).
- **No stale tenant context.** `withOrg` (`packages/db/src/tenant.ts:24-30`) sets the role and the organisation with `SET LOCAL` and `set_config(..., true)` inside a transaction. Both end at COMMIT or ROLLBACK, so a pooled connection cannot carry them into the next request. A null organisation reads as empty.
- **Least-privilege grants.** The app role has no DELETE on people, memberships, badges, check-ins or households (0007:119-123). `anon` and `authenticated` lose all access (0005). `org_members` is read-only for request handling (0006).
- **Audit log.** Append-only: update and delete are refused by trigger, and TRUNCATE is refused (0001, 0003). Audit rows are written in the same transaction as the change (for example `PgPeopleRepository.ts`, `PgCredentialRepository.ts`).
- **Badges.** 128 bits from the OS CSPRNG (`packages/domain/src/people/credential.ts:5`, `apps/web/lib/qr/tokens.ts:6`). Only the SHA-256 is stored (`tokens.ts:9`) and the hash is unique (0007:83). At most one active badge per person (0007:86). Reissue revokes the old badge in the same transaction. The token is returned once.
- **Check-in race.** The partial unique index (0007:106) is the final guard. A lost race is answered as "already on site" (`createAttendanceService.ts:63-67`). Overrides are admin-only and need a written reason (`packages/domain/src/people/attendance.ts:22-29`).
- **Viewer redaction of contact data.** `createPeopleService.ts:54-60` withholds date of birth, email, phone and minor status unless the actor has `people:read_contact`. The check is in the service, not only in the UI.
- **Camp selection.** A posted camp id is only honoured if it is in the session's memberships (`features/camp/actions/failures.ts:9-10`, `selectCampAction.ts:11`).
- **Redirects.** All redirect targets are constants (`signIn.ts:19`, `signUp.ts:23`, `createCampAction.ts:26`). There are no open redirects.
- **Injection and XSS.** SQL is parameterised throughout. The only dynamic SQL is column names from a fixed list (`PgPersonWrites.ts:19-37`). No `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `javascript:` URLs (grep). No file uploads.
- **CSV.** Formula neutralisation and RFC 4180 quoting (`features/attendance/lib/csv.ts:13-31`). The download file name is built from validated dates (`lib/paths.ts:12`). Responses are `no-store`.
- **Headers.** A per-request CSP nonce, no inline scripts without it, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restricted Permissions-Policy (`config/security.ts`, applied in `proxy.ts`). No CORS headers are sent anywhere.
- **Error responses.** Unexpected errors return a generic 500 with a request id (`server/http/route.ts:26-27`). Error pages show a digest only. There are no stack traces in responses.
- **Logs.** Request logs have method, path, status and duration only; query strings and headers are never logged (`route.ts:59`). A rejected token is logged by error name only (`sessionFromToken.ts:17`). Request ids from callers are sanitised (`requestId.ts`).
- **Secrets.** Nothing committed except placeholders (`buxa:buxa` on localhost, `test-project.supabase.co`). `.env*` files are git-ignored. No service-role key is referenced. The Docker and Render files were removed earlier (commit `9eb1f65`) and are not in the tree.

## 2. Findings

Status is one of **confirmed** (by reading the code and cited lines) or **suspected** (needs a test before it counts). "Blocks child data" means it should be fixed before real children's data is stored.

### Medium

#### S-01: a completed check-out can be overwritten by a concurrent one
- **Severity:** medium. **Status:** confirmed by reading; needs a concurrency test. **Blocks child data:** yes.
- **Where:** `apps/web/server/attendance/PgCheckInWrites.ts:22-27` (the `UPDATE check_ins ... WHERE id = $1` has no open-visit condition and the row count is not checked). `apps/web/server/attendance/PgAttendanceRepository.ts:34-40` (the visit is read, then closed by id).
- **What can happen:** two check-outs for the same child that overlap both read the visit as open. The second `UPDATE` overwrites `checked_out_at`, `checked_out_by` and `collected_by_person_id` set by the first. Both write audit rows, so the log shows two check-outs with different collectors, and nothing reports the conflict. The record of who collected a child can be replaced after the fact.
- **Minimal fix:** add `AND checked_out_at IS NULL` to the `UPDATE`, and throw `NotOnSiteError` when `rowCount` is not 1.

#### S-02: viewers can read child attendance and resolve badges to children
- **Severity:** medium. **Status:** confirmed. **Blocks child data:** yes.
- **Where:** `packages/domain/src/permissions.ts:27` (viewer holds `attendance:read`). `apps/web/server/services/attendance/createAttendanceService.ts:121-168` (`onSite`, `log`, `history` check only `attendance:read`). `apps/web/server/services/credentials/createCredentialService.ts:40-41` (`scan` checks `attendance:read`). `apps/web/features/attendance/screens/AttendanceScreen.tsx:18`, `OnSiteScreen.tsx:13`. `apps/web/features/attendance/actions/scanCode.ts:10-15`.
- **What can happen:** any viewer account can see every child's check-in and check-out times, who collected them, notes and overrides, and who is on site now. A viewer can also scan any badge and get the child's name, roles and status. `docs/security.md:17` says attendance is for "staff and above", and `docs/security.md:13` says viewers see "names and roles only". The code and the docs disagree.
- **Minimal fix:** decide the rule first. Then remove `attendance:read` from the viewer grant, or add a names-only action for viewers. Have the scan action check `attendance:record`, not `attendance:read`.

#### S-03: viewers see household pickup flags, memberships and badge status
- **Severity:** medium. **Status:** confirmed. **Blocks child data:** yes (custody information).
- **Where:** `apps/web/server/services/people/createPeopleService.ts:61-63` (memberships, households and `hasActiveBadge` returned to any reader of the person). `apps/web/server/services/shared/views.ts:39-46` (household members carry `relationship`, `isGuardian` and `canPickup` for everyone). Viewers hold `people:read` (`permissions.ts:27`).
- **What can happen:** a viewer sees each child's membership plan and dates, revocation reasons (free text), the household relationships, and which guardians are authorised to collect the child. `docs/security.md:13` says viewers see names and roles only.
- **Minimal fix:** in `personView` and `toHouseholds`, return memberships, relationship, pickup flags and badge status only to actors with a staff permission (for example `attendance:record` or `memberships:manage`). Viewers get names and roles.

#### S-04: any staff member can authorise pickup of a child
- **Severity:** medium. **Status:** confirmed. **Blocks child data:** yes (child-safety control).
- **Where:** `packages/contracts/src/people.ts:73-77` (`canPickup` is an input). `apps/web/server/services/people/createPeopleService.ts:162-164` (`linkToHousehold` checks only `people:update`). `permissions.ts:28` (staff hold `people:update`). `apps/web/server/people/PgPeopleRepository.ts:88-96` (`link`). `apps/web/features/people/actions/linkHouseholdAction.ts:13-23`.
- **What can happen:** a staff member, or anyone holding a staff account, can mark any guardian as able to collect a child. Check-out (`packages/domain/src/people/attendance.ts:52`) then lets that person collect. The change is audited only as `household.update` with the person id; the pickup flag is not recorded.
- **Minimal fix:** a separate permission (for example `people:authorise_pickup`, admin and above) checked whenever `canPickup` is set or changed. Record the flags in the audit entry.

#### S-05: the email-confirmation refusal is enforced only on `/v1` routes
- **Severity:** medium. **Status:** confirmed. **Blocks child data:** no direct effect today. Fix before invitations exist.
- **Where:** `apps/web/server/runtime.ts:54-61` builds `startupCheck`, which returns `refuse` when Supabase auto-confirms sign-ups in production. The only consumer is `apps/web/server/http/route.ts:50`. Pages (`app/(app)/*`) and server actions (`features/auth/actions/signUp.ts`, `signIn.ts`) never await it. `docs/deploy.md:46` says the server "refuses to serve (503)", and `docs/auth.md:52` says "the API refuses to start". Neither is true for pages.
- **What can happen:** if "Confirm email" is turned off in production, the sign-up form and the camp pages still work. Anyone can register an address they do not own. Nothing grants access to child data from that account today, because invitations are not built.
- **Minimal fix:** await the decision in the camp layout and in the session path (`requireSession`/`getSession`) and show a maintenance page on `refuse`. Or, if the intent is API-only, correct both docs.

#### S-06: the request handling connection bypasses row-level security, and the docs say otherwise
- **Severity:** medium. **Status:** confirmed by reading. The effect depends on the Supabase login used (not checked). **Blocks child data:** yes (defence in depth before real data).
- **Where:** `docs/deploy.md:20-21` (`DATABASE_URL` and `MIGRATION_DATABASE_URL` are the same URI) and `docs/deploy.md:32` (the login must bypass row-level security, a superuser or Supabase's `postgres` role). `packages/db/migrations/0004_app_role_membership.sql:6` (`GRANT buxa_app TO CURRENT_USER`). `apps/web/server/users/PgUserRepository.ts:14-33` and `apps/web/server/orgs/PgOrgRepository.ts:14-26` (privileged pool). `apps/web/app/ready/route.ts:8`. The role switch is `packages/db/src/tenant.ts:27`.
- **What can happen:** RLS protects tenant data only where a query goes through `withOrg`. The login the app uses owns the schema and can bypass RLS. Any future query on the pool (a new repository, a bug, or an injection) runs with those rights and can read `schema_migrations` and rows of other camps. `docs/security.md:26` says "the app connects as a restricted role. It cannot read the migration history". That is not what runs.
- **Minimal fix:** give the request runtime its own login that is a member of `buxa_app` only (no bypass, no `CREATEROLE`). Keep the migration login separate. Move the user upsert and org creation into narrow `SECURITY DEFINER` functions. Correct `docs/security.md` section 2.

#### S-07: no rate limits on any write or expensive endpoint
- **Severity:** medium. **Status:** confirmed. Known open item (`docs/auth.md:49`, `docs/security.md:38` and `:62`). **Blocks child data:** yes (open item in `docs/security.md` section 6).
- **Where:** `apps/web/app/v1/orgs/route.ts:8-11` and `apps/web/features/camp/actions/createCampAction.ts:15-22` (any signed-in user can create camps, each a database write on the privileged pool). `apps/web/features/attendance/actions/scanCode.ts:10-15` (unlimited scans). `apps/web/app/ready/route.ts:6-14` (unauthenticated database query on every call).
- **What can happen:** a signed-in user can create unlimited camps and slugs, and anyone can drive database load through `/ready`. Scans are unlimited. Guessing a 128-bit badge token is not practical, but scan volume is unmonitored.
- **Minimal fix:** rate-limit these by user id and by IP (Vercel firewall rules or a shared limiter). Cache the `/ready` result for a few seconds.

### Low

#### S-08: viewers can read staff email addresses
- **Severity:** low. **Status:** confirmed. **Blocks child data:** no (staff data).
- **Where:** `apps/web/server/orgs/PgOrgRepository.ts:47-53` returns `u.email` for every member. Viewers hold `members:read` (`permissions.ts:27`). Reached through `apps/web/app/v1/members/route.ts` and the camp Members screen.
- **Minimal fix:** return names and roles to viewers. Return email only to admins, or drop it from the list.

#### S-09: a conflict message reveals that another account owns an email
- **Severity:** low. **Status:** suspected (reachable only when Supabase's email differs from the stored one; needs a test).
- **Where:** `apps/web/server/users/UserRepository.ts:7` (message "This email address is already linked to a different account"). `apps/web/server/auth/sessionFromToken.ts:25` passes it to a 409 on the API. The cookie path treats 409 as signed out (`apps/web/server/session/index.ts:47`).
- **Minimal fix:** return a generic conflict message on the API and log the detail on the server.

#### S-10: the sign-up answer may differ for an existing address
- **Severity:** low. **Status:** suspected. Needs a test against the Supabase project's sign-up settings.
- **Where:** `apps/web/features/auth/lib/messages.ts:9-12` (every unrecognised sign-up error becomes "Could not create the account"). A successful sign-up returns `CONFIRM_EMAIL_MESSAGE` (`features/auth/actions/signUp.ts:24`). If Supabase returns "User already registered", the two answers differ and reveal the account. The sign-in message at `messages.ts:3` ("Confirm your email first") appears only after the password is checked, so it is informational.
- **Minimal fix:** map "already registered" to `CONFIRM_EMAIL_MESSAGE`. Confirm the Supabase response with a test account.

#### S-11: the body-size limit does not cover requests without `Content-Length`
- **Severity:** low. **Status:** confirmed.
- **Where:** `apps/web/server/http/route.ts:51` checks only the `Content-Length` header. `apps/web/server/http/parse.ts:6` reads the full body with `request.text()`.
- **What can happen:** a chunked request with no `Content-Length` is read without the 1 MB limit. Vercel's platform limit reduces the impact.
- **Minimal fix:** count bytes while reading the body and stop at the limit.

#### S-12: email and phone format are not validated, so a typo becomes a 500
- **Severity:** low. **Status:** confirmed.
- **Where:** `packages/contracts/src/people.ts:49` and `:62` accept any string up to 254 characters for email. The database rejects a missing `@` (`packages/db/migrations/0007_people_checkin.sql:18`). `apps/web/server/services/shared/errors.ts:8-13` passes unknown errors through. `apps/web/features/people/actions/failures.ts:12` rethrows non-HTTP errors, so the user sees the error page.
- **Minimal fix:** validate email and phone format in the contracts. Map Postgres `23514` (check violation) to a 400.

#### S-13: a pooled connection is released even when its rollback failed
- **Severity:** low. **Status:** suspected. Needs a fault-injection test.
- **Where:** `packages/db/src/tenant.ts:13` (`ROLLBACK` error ignored) and `:16` (`db.release()` with no argument).
- **What can happen:** if the rollback fails, the connection may still be inside a transaction with `SET LOCAL ROLE buxa_app` applied, and it goes back to the pool.
- **Minimal fix:** call `db.release(true)` when the rollback fails, so the client is destroyed.

#### S-14: the local dev server can be exposed if `HOST` is not loopback
- **Severity:** low. **Status:** suspected for exposure (the code path is confirmed). Dev only.
- **Where:** `apps/web/legacy-server/index.ts:5` (`HOST` from the environment). `apps/web/legacy-server/app.ts:39` and `:41` (Host and Origin checks, which only protect browsers). `app.ts:79` (`PUT /api/state` has no authentication). `app.ts:97` (`POST /api/agents/:id/token` issues MCP tokens with no authentication).
- **What can happen:** with `HOST=0.0.0.0`, a non-browser client on the network can send `Host: localhost` and read or write the local kanban data or mint MCP tokens. This server is not in the Vercel build; the `next.config.ts` rewrites apply only in development.
- **Minimal fix:** refuse a non-loopback `HOST` unless explicitly allowed, and require the `X-Buxa-Client` header on every `/api` route.

#### S-15: a concurrent badge reissue returns a 500
- **Severity:** low. **Status:** suspected. Needs a concurrency test.
- **Where:** `apps/web/server/credentials/PgCredentialRepository.ts:44-48`. A second concurrent reissue waits on the partial unique index and then fails with `23505`, which is not mapped to a conflict.
- **What can happen:** one caller gets a 500 page. No duplicate active badge is possible, because the index holds.
- **Minimal fix:** map `23505` to `conflict` in `issue()`.

#### S-16: a missing camp in the membership list becomes a 500
- **Severity:** low. **Status:** confirmed (code quality).
- **Where:** `apps/web/server/orgs/PgOrgRepository.ts:32` throws `OrgNotFoundError`. `apps/web/server/services/shared/errors.ts:8-13` does not translate it.
- **Minimal fix:** translate `OrgNotFoundError` to a 404 in `translateRepositoryError`.

### Info

#### S-17: static files and the icon get no security headers
- **Where:** `apps/web/proxy.ts:34` excludes `_next/static`, `_next/image` and `icon.svg` from the matcher. `apps/web/next.config.ts` has no `headers()`. These files are public and carry no data, so the impact is small.

#### S-18: the demo password is shown on the sign-in page
- **Where:** `apps/web/features/auth/components/DemoSignIn.tsx:27` prints `DEMO_PASSWORD` (`apps/web/features/kanban/lib/seed/ids.ts:2`, value `demo1234`). `apps/web/features/kanban/state/actions/auth.ts:15` checks it in the browser. It creates no session. Keep it that way, and never use these demo accounts in Supabase.

#### S-19: role-management rules have no routes yet
- **Where:** `permissions.ts:66-89` defines invite, change role, remove, leave, last owner and transfer. No route or service calls them, so there is no escalation path today (`org_members` is read-only for the app role, migration 0006). When routes are added, the new write policies must be narrow, as 0006's comment says.

#### S-20: logging and error handling
- **What is logged:** request id, method, path, status, duration. Rejected-token reason as an error name. Startup warnings. Unhandled errors with their stack (`route.ts:26`). Postgres messages for foreign-key and check violations carry ids or column names, not personal values.
- **Swallowed errors:** the session reader treats any error as signed-out (`apps/web/server/session/index.ts:34`), and the refresh path returns null on error (`refresh.ts:27`). These are reasonable for availability. Consider a `warn` log so a broken identity provider is visible.
- **Platform logs are not covered.** Vercel request logs may keep full URLs, including `?personId=` query strings, because the app does not control them.

#### S-21: the CSV download is a GET with the session cookie
- **Where:** `apps/web/app/(app)/camp/(ops)/attendance/export/route.ts:4-6`. A cross-site page can start a download through a top-level navigation (SameSite=Lax allows it). It cannot read the response and it changes no state. Keep the route read-only.

## 3. Dependencies

| Scope | Critical | High | Moderate | Total |
|---|---|---|---|---|
| `npm audit --omit=dev` | 0 | 0 | 0 | 0 |
| `npm audit` (full tree) | 2 | 1 | 3 | 6 |

Full-tree findings (all dev or test tooling; none ship in the deployed bundle):
- **critical:** `vitest` at or below 4.1.10, GHSA-5xrq-8626-4rwp (arbitrary file read and execution when the Vitest UI server is listening). Direct dependency.
- **critical:** `tinypool` at or below 2.1.1, GHSA-5gmw-xhrv-c9v3 and GHSA-85c8-ppgw-ccpr (prototype pollution leading to code execution through worker options). Pulled in by vitest.
- **high:** `vite` at or below 6.4.3, several advisories (path traversal in optimised deps, cross-origin script execution through custom middleware, `server.fs` bypasses). Pulled in by vitest.
- **moderate:** `@vitest/mocker`, `esbuild` (at or below 0.24.2) and `vite-node`.

Fix: `vitest` 5.1.0, a semver-major upgrade. Not applied, per instructions. Schedule it as its own change and run CI afterwards.

## 4. Secrets and configuration

- **Working tree:** no keys, tokens or connection strings. `NEXT_PUBLIC_SUPABASE_*` values are read from the environment (`apps/web/.env.example` uses placeholders).
- **Git history (`git log --all -p`, pattern search):** only local placeholders (`buxa:buxa@localhost:5433`, `deployer:deployer@localhost:5434`, `u:p@127.0.0.1`), the test host `test-project.supabase.co`, and documentation that tells readers not to use a service-role key. No `sb_secret_`, JWT, private key or Vercel identifier was found.
- **Ignored files:** `.env`, `.env.*` (except `.env.example`), `.buxa-data`, `coverage`, `.vercel` and `.claude/settings.local.json` are git-ignored. No env file is tracked.
- **Dockerfile and render.yaml:** absent from the tree. They were removed in commit `9eb1f65`, so the root-user, exposed-port and build-arg checks do not apply to this commit.
- **Build and deploy:** `apps/web/vercel.json` runs `scripts/vercel-build.ts`. Production builds apply migrations with `MIGRATION_DATABASE_URL` (or `DATABASE_URL`). Preview builds skip migrations. This is correct, but see S-06 about the login used.
- **Seed reset:** `scripts/seed-mock/guard.ts` refuses any database host other than loopback, including a `host=` override in the URL.

## 5. Headers, caching and cookies

- **Content-Security-Policy:** nonce-based script policy, `connect-src` limited to the configured Supabase origin, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`. `style-src 'unsafe-inline'` is a documented trade-off (React inline styles). `unsafe-eval` only in development (`config/security.ts`, tested in `config/security.test.ts`).
- **Other headers:** HSTS (one year, includeSubDomains, no preload), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, Permissions-Policy denying camera, microphone and geolocation.
- **CORS:** no `Access-Control-*` headers anywhere. The API cannot be called cross-origin from a browser.
- **Caching:** API responses set `no-store` (`route.ts:33`). `/health` and `/ready` and the CSV export are `no-store`. Pages that read cookies are dynamic in Next.js, but the emitted `Cache-Control` for pages was not checked at runtime (see "could not audit").
- **Cookies:** names, flags and path are set in code. Domain is host-only (not set), so cookies do not span subdomains.

## 6. Badges and check-in

- **Token:** 128 bits, base64url, prefixed `bx1.`. The stored form is the SHA-256 hash (unique index). The token is shown once and never read back (`issueBadgeAction.ts:28`).
- **Lookup:** indexed equality on the hash (`PgCredentialRepository.ts:79-80`). This is not a constant-time comparison, but the compared value is a hash of a 128-bit random secret, so timing reveals nothing usable.
- **Scan abuse:** no rate limit (S-07). Unknown and malformed codes get the same answer (`createCredentialService.ts:44-49`).
- **Duplicate scans:** the server refuses a second open check-in (`packages/domain/src/people/attendance.ts:23`) and the partial unique index backs it up (0007:106). The client-side dedupe window (`features/scanner/dedupe.ts`) was not reviewed in detail.
- **Race on check-in:** handled (see "done well"). **Race on check-out:** not handled (S-01).

## 7. Input handling

- **Validation:** every server action and `/v1` route validates with a zod schema from `packages/contracts` (`parseWith`, `parseInput`, `parseBody`). Identifiers are checked as UUIDs before they reach SQL.
- **Uploads:** none.
- **Redirects:** constants only (see "done well").
- **CSV:** see "done well". Formula prefixes (`=`, `+`, `-`, `@`, tab, CR) are neutralised, including on names and free-text notes.
- **Email and phone:** format not validated (S-12).

## 8. Authentication and sessions

- **Sign-in:** `features/auth/actions/signIn.ts`. Supabase checks the password. Errors map to general messages (`messages.ts:2-7`). No client-side account lookup.
- **Sign-up:** `signUp.ts`. Email confirmation is required in Supabase's settings, but the app only checks this at startup and only for `/v1` (S-05). Sign-up answers may differ for an existing address (S-10).
- **Sign-out:** `signOut.ts:10-15` ends the Supabase session and clears the camp cookie.
- **Password reset:** not built. No code path exists. Supabase owns the flow when it is added.
- **Session expiry and refresh:** the proxy refreshes near expiry with a 2.5 s timeout (`server/session/refresh.ts:6,18-29`). The session lifetime depends on Supabase's JWT expiry and refresh-token settings, which are not in the repo (see "could not audit").
- **Account enumeration:** see S-09 and S-10.
- **Multi-factor:** not enforced (documented open item).

## 9. Authorisation

- **Route handlers:** `/v1/me`, `/v1/org` (GET and PATCH), `/v1/orgs` (POST), `/v1/members` (GET). Each uses `authedRoute` and, where a camp is named, `actorFor` (`orgScope.ts`), which checks membership before any service call.
- **Server actions:** every people, attendance, camp and auth action resolves the actor from the session and calls a service that runs `assertAllowed`. Actions do not trust a role or camp id from the client.
- **IDOR:** person, household and membership ids from the client are looked up inside the actor's organisation (RLS plus `people.get`) before any change. Cross-camp ids resolve as "not found".
- **Privilege escalation:** no role-changing route exists (S-19). `org_members` is read-only for the app role.
- **Bypass of `assertAllowed`:** none found. `can()` is used only to shape the UI and the check-in response.

## 10. Code quality items that affect safety

- No `TODO`, `FIXME`, `XXX` or `HACK` in auth, data or attendance code.
- No `@ts-ignore`, `@ts-expect-error` or `any` in the server, auth, people or attendance code.
- Swallowed errors in security-relevant code: S-13 and the items under S-20.
- **Unhandled rejection paths:** none found in server code. The timer in `refresh.ts:26` is not cleared, but it is `unref`'d and has no effect on safety.
- **Dead code exposing endpoints:** `apps/web/legacy-server/` is reachable only through `npm run server`. It is not part of the Vercel build. See S-14.
- **Placeholder services:** `server/unimplemented.ts` is a helper, not an endpoint. `noPlaceholders.test.ts` enforces that services are not placeholders.

## 11. What could not be audited here

- **Live deployment:** the headers actually served, CDN behaviour, cache headers on dynamic pages, TLS configuration, and the response to malformed requests.
- **Supabase project settings:** "Confirm email", JWT signing keys, session and refresh-token lifetimes, rate limits on sign-in and sign-up, the sign-up response for an existing address (S-10), SMTP, Data API exposure, and which login `DATABASE_URL` uses (S-06).
- **Vercel settings:** environment variable scoping per environment, root directory, function region, firewall rules, log retention and access, and whether preview deployments can reach production data.
- **Real browser session:** the cookie attributes as the browser stores them, CSP violation behaviour under real rendering, nonce handling in production, and the printed badge.
- **Concurrency and fault tests:** the check-out race (S-01), badge reissue (S-15) and rollback failure (S-13) were reasoned from code, not run.
- **Penetration test and fuzzing:** none run. No load test of the scanner.
- **Client code:** the camera scanner and the dedupe window (`features/scanner/`) and the browser-only kanban demo were not reviewed in depth.
- **Legacy MCP server:** only its HTTP layer and token handling were read. Its tools and data store were not.
- **Backups and restore:** not verifiable from the repo (`docs/deploy.md`).
- **Git history:** searched by pattern for secrets and env files. Not reviewed commit by commit.
- **Next.js documentation:** `apps/web/AGENTS.md` asks for the guides under `node_modules/next/dist/docs/`. Only the server action origin check was verified (in the built runtime code). No other Next.js behaviour was checked against those guides.
- **Legal and privacy:** COPPA, state rules and retention are outside this audit (`docs/security.md` section 4).

## 12. Method

- **Read in full:** `docs/security.md`, `docs/auth.md`, `docs/deploy.md`, `docs/ROADMAP.md`, `packages/domain/src/permissions.ts`, `packages/domain/src/people/attendance.ts`, `packages/domain/src/people/credential.ts`, `packages/contracts/src/*`, all migrations in `packages/db/migrations/`, `packages/db/src/*`, `apps/web/proxy.ts`, `apps/web/config/security.ts`, `apps/web/server/auth/*`, `apps/web/server/session/*`, `apps/web/server/http/*`, `apps/web/server/runtime.ts`, `apps/web/server/config.ts`, the services, Postgres repositories and audit writer, the v1 routes, every server action under `features/auth`, `features/camp`, `features/people` and `features/attendance`, the attendance export route, `features/attendance/lib/csv.ts`, `lib/qr/tokens.ts`, `scripts/vercel-build.ts`, `scripts/seed-mock/guard.ts`, `next.config.ts`, `vercel.json`, `.gitignore`, `.env.example`, and `apps/web/legacy-server/app.ts` and `index.ts`.
- **Searches:** `use server` files, route handlers, every `.query(` call, `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `javascript:`, `searchParams` and redirects, `console.*`, `TODO`, swallowed `catch`, `@ts-ignore`, `access-control`, secret patterns in the tree and in history, and `startupCheck` consumers.
- **Commands:** `npm ci`; `npm audit --omit=dev` and `npm audit`; `DATABASE_URL=postgres://buxa:buxa@localhost:5433/buxa npm test` (Postgres already running).
- **Changes:** none to application code, tests or configuration.
