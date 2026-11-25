# Security and data protection

Status: **the app is not ready for real children's data.** Keep to mock data until the open items in
section 6 are done and the privacy review is signed off. This page says what is built, what is planned, and what is missing.

## 1. What we hold, and where

| Data                                      | Examples                                                                      | Stored in                                                          | Who can read it                                                                                     | Kept for                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Sign-in credentials                       | email, password hash, sessions                                                | Supabase Auth (never in our database)                              | the user only                                                                                       | while the account exists                  |
| Camp settings                             | camp name, slug, time zone                                                    | Postgres                                                           | camp members                                                                                        | while the camp exists                     |
| Staff access                              | role per camp                                                                 | Postgres                                                           | camp admins and owners                                                                              | while the membership exists               |
| People (children, guardians, instructors) | names, roles, household links, date of birth                                  | Postgres, row-level security per camp                              | staff and above; viewers see names and roles only                                                   | **not yet defined** (open item)           |
| Contact details                           | email, phone                                                                  | Postgres                                                           | staff and above (`people:read_contact`)                                                             | not yet defined                           |
| Emergency contact                         | name, phone and relationship of an adult to call for a person                 | Postgres, row-level security per camp (`people`, migration `0073`) | staff and above (`people:read_contact`), and the family's guardian for their child (section 2)      | while the person exists: erased with them |
| Memberships                               | start and end dates, revocation reason                                        | Postgres                                                           | staff and above                                                                                     | not yet defined                           |
| Badges                                    | SHA-256 hash of a random 128-bit token, and the token encrypted (AES-256-GCM) | Postgres                                                           | staff cannot read it; admins and owners, the person, and their guardian can show it (see section 2) | until reissued or revoked                 |
| Attendance                                | check-in and check-out times, who checked them in                             | Postgres                                                           | staff and above                                                                                     | not yet defined                           |
| Audit log                                 | who did what, when, to which record                                           | Postgres, append-only                                              | admins                                                                                              | not yet defined                           |
| Staff board tasks (browser demo)          | task titles and comments                                                      | the user's browser (local storage)                                 | the browser only                                                                                    | until cleared                             |

| Family documents (uploads) | immunization records sent with a registration (PDF or image, up to 1 MB) | Postgres, row-level security per camp (`registration_files`, migration `0061`) | staff with `registration:read`; a review needs `registration:confirm` | with the registration: erased with it (section 2) |
| Form attachments | a blank form families download, such as an immunization form (up to 1 MB) | Postgres, row-level security per camp (`registration_form_files`, migration `0060`) | camp members; families only through the download route for the session they register for (section 2) | while the form exists |

**Rule:** the staff board keeps its data only in the browser. It is not sent to the Buxa server, so it must not hold real data.

## 2. What is built

- **Tenant isolation:** every camp table has row-level security, forced on for the app's database role. A test fails if a new table lacks it. Cross-camp foreign keys are blocked by composite keys.
- **Teaching access follows the roster person (migrations `0051` and `0069`).** A class's instructors are the people in `session_instructors`. An instructor's login is linked to its roster person (`people.user_id`, with a composite key to the camp's membership, so the link cannot cross camps). The teaching view is a viewer login whose person holds the instructor role (`person_roles`, see `docs/ROLES.md`). It sees a class only when its linked person is one of the class's instructors, and an instructor with no linked person sees no classes. The teaching view holds only the grants a teacher had, and no staff or admin right. There is no teacher access level: migration `0069` moved every teacher login to viewer access with the instructor role. The link is set when the invite is accepted (the invite email must match the login), and it is cleared when the membership is removed. The old `class_teachers` table is dropped only when every row was copied; a row with no matching person is reported and keeps the table (see `docs/phases/04-seats-rosters.md`).
- **Least privilege, enforced now:**
  - In the database (migrations `0004` to `0009`): the request role `buxa_app` cannot read `schema_migrations`, is not a superuser and has no `BYPASSRLS` or `CREATEROLE`. It cannot insert or change users, organisations or memberships directly. It has no delete rights on people, memberships, badges, check-ins or households. Its only cross-organisation paths are three `SECURITY DEFINER` functions with a fixed search path, executable by `buxa_app` only: the sign-in user row, the sign-in membership lookup, and organisation creation. Tests: `packages/db/test/narrow-privileges.test.ts`, `apps/server/src/users/__tests__/runtimeLogin.pg.test.ts`.
  - In the code: every tenant query runs through `withOrg`, which switches to `buxa_app`. Request handling does not use the migration login.
  - **Login check in the app:** in production the app reads the attributes of its own database login (`SUPERUSER`, `BYPASSRLS`, and membership of a role with either). A privileged login is refused: `/ready` answers 503 `unrestricted_login`, and tenant queries fail. The web app reads only `DATABASE_URL`, never the migration URL. Tests: `packages/db/test/login-privileges.pg.test.ts` (real logins), `packages/db/test/login-privileges.test.ts`, `apps/web/__tests__/readyLogin.test.ts`, `apps/server/src/__tests__/config.test.ts`.
  - **Not enforced by the database until the switch is made:** the login the server connects with is whatever `DATABASE_URL` names. Until the operator creates the restricted runtime login and moves `DATABASE_URL` to it (`docs/deploy.md`, "Operator steps"), the live connection is the migration login, and the app refuses to serve it in production. The statements about the live connection hold only after that step has passed `/ready`.
  - **Erasing a registration's answers (migration `0054`).** A registration holds a child's and a guardian's details in its `answers`. An admin or the owner (`registration:delete`) can erase one: `buxa_delete_registration_v1` (SECURITY DEFINER, checks the caller is an admin or owner of the camp itself) blanks `answers`, then deletes the registration and, by cascade, its places. The request role has no DELETE on `registrations` or `registration_classes`, so this is the only way. It refuses a registration whose places still hold an active enrolment or an unreleased seat hold, so seats are given back first (withdraw, or the service releases a pending registration's holds). The audit row, `registration.delete`, records the form id, the status and the number of places and nothing else: no name, phone, date of birth or answer. The earlier audit rows for the registration (`registration.submit`, `registration.confirm`, `registration.payment`) never held answers either, only ids, counts and whether a payment note exists. Withdraw keeps the answers, and archive only hides the registration, so neither is an erasure. A draft session's deletion removes its setup only (classes, groups, rooms, assignments, instructor links); it can hold no registrations.
  - Erasure of a whole camp's data needs a separate, reviewed process. The matrix gives `data:erase` to the owner only, but no erase code exists yet, so nothing can erase a camp's data today.
- **Camp name and time zone (migration `0036`).** Only an admin or the owner may change them. The app checked `org:update` already, but the row policy let any member update the camp row. The policy now requires the signed-in user's role to be admin or owner, so the database refuses a staff member's change too.
- **Roles and person delete (migrations `0039` and `0040`).** A member's role changes only through one definer function, which checks the actor's role itself: an admin or owner, never one's own role, only an owner makes or removes an owner, and the camp keeps at least one owner. Deleting a person is owner-only in the database as well as in the service. Both write an audit row in the same statement, and the delete row carries no personal details.
- **Team access expiry (migration `0043`).** A camp membership can end on a day (`org_members.expires_at`; null means no expiry). An expired membership is no membership in the database: `is_member()` returns NULL for it, so every row policy refuses the camp's data, and `buxa_memberships_of()` leaves the camp out of the sign-in list, so the server's `actorFor()` refuses it the same way as a stranger. The expiry is set or cleared only through `buxa_set_member_expiry`, which applies the role rules (an admin or owner, never one's own, and only an owner changes an owner's expiry) and writes `member.expiry_set` or `member.expiry_clear` with the old and new value in the same statement. Season passes (the `memberships` table) expire by their own dates and are not affected. Tests: `packages/db/test/membership-expiry.test.ts`, `apps/server/src/services/__tests__/memberExpiry.test.ts`.
- **Session membership (audit items 5.1 and 5.3).** The expand step (`0032`) adds functions that read the signed-in user from `current_user_id()`. The contract step (`0034`) drops the older functions that took a user id, and requires a signed-in member in every row policy. Both are on the Phase 3 branch. Whether `0034` has been applied to production is not confirmed in the repository: check `schema_migrations` before you call audit item 5.1 closed.
- **Terminal records (migration 0055):** a revoked badge cannot be reactivated (a trigger refuses clearing `revoked_at`, and a revoked badge holds no sealed token), and the request role may update only `revoked_at` and the three sealed-token columns of `credentials`. A released seat hold is final (a trigger refuses any change to its release, class, household, child or expiry), and the request role may update only `released_at` and `release_reason`. Tests: `packages/db/test/db-integrity.test.ts`, `apps/server/src/holds/__tests__/seatHoldRepository.pg.test.ts`.
- **Role-aware database policies, step one (migrations `0057` and `0058`).** Until now every camp table asked only whether the signed-in user is a member; the role matrix was enforced in the app. The database now also enforces the role for these tables, so a login that reached SQL without the role for the table is refused (the agreed role rules are in `docs/ROLES.md`; a viewer whose person is an instructor is in the teaching view):
  - `audit_log`: SELECT for an admin or owner only. Inserts stay open to every current member (the app writes the audit row in each action's transaction).
  - `credentials`: INSERT and UPDATE for an admin or owner only. SELECT stays open to members (check-in resolves a badge by its hash), but the request role cannot SELECT `token_ciphertext`, `token_iv` or `token_auth_tag` at all. Showing a badge again goes through `buxa_reveal_badge()`, a definer function that returns the sealed copy only to an admin or owner, the person themself (by email) or a guardian of that child's household, as the show service already allowed. Revoked-state rules on credentials are migration `0055`.
  - `camp_calendar_tokens`: SELECT, INSERT and UPDATE for an admin or owner only. The public feed reads it through definer functions.
  - `member_options`: reads by the member themself, an admin or an owner; writes by an admin or owner (in practice through `buxa_set_member_option`).
  - `notifications`: an insert needs a current membership of the camp.
  - **Rename ownership.** `buxa_rename_member_v2` now changes the camp's roster name on `people` (the person linked by `people.user_id`) and never writes `users`, so one camp's admin cannot rename a person in another camp. A member with no roster person is refused with a message. A login's own name is still edited only by that user.
  - Tests: `packages/db/test/role-aware-policies.test.ts` (every role, a non-member and an expired member), `narrow-privileges.test.ts`, `security-definer-catalogue.test.ts`.
  - **Still app-only:** writes to `people`, households, enrolments, check-ins, classes, sessions, seat holds and registrations are checked by the app role matrix, not by the database. They are the next step, with tests for every role.
- **Registration files (migrations `0060` and `0061`).** No object storage is configured (Supabase is used for sign-in only), so files are kept in Postgres as `bytea`, under the same row-level security, backups and deletion as the rest of the camp's data. Adding a second storage provider would add a new place for personal data, so none was added.
  - **Limits:** one file is at most 1 MB (`ATTACHMENT_MAX_BYTES`, the same limit as a staff task's attachment). The type is read from the file's first bytes (PDF, JPEG, PNG or WebP), never from its name or the browser's type. The tables repeat the type list and the size as constraints; the content check itself stays in the app.
  - **Form attachments** (`registration_form_files`): members read them; only an admin or the owner adds or removes one (`registration:manage`). A save takes at most ten files.
  - **Family documents** (`registration_files`): one row per document question per registration. The answer holds the file id and its review (`answers.custom.<key>` = `{ fileId, status }`). A submission stores the file in the same transaction as the registration. A required question with no file is shown as **Not received** and does not stop the registration.
  - **Review:** `pending` (the default on upload), `accepted` or `needs_replacing`, set by `buxa_set_document_review_v1`. The function updates the file and the answer together, and checks the caller's role (staff, admin or owner). The request role cannot update either table directly.
  - **Download routes** (Next route handlers, `apps/web/app/(app)/camp/(operations)/registration/`):
    - `GET /camp/registration/files/{fileId}?session={sessionId}` sends a form attachment. The service needs `registration:submit`, and the join requires the file's form to cover `sessionId` (`registration_form_sessions`). A file of another camp, another form or a session the form does not cover answers **404** with one message. Families reach it through the same route once they have a parent login (phase 6); until then staff who take a registration hand the file out.
    - `GET /camp/registration/documents/{fileId}` sends a family's document. The service needs `registration:read`; a file of another camp answers 404.
    - Both answer as an attachment (`Content-Disposition: attachment`), with the stored type, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. The bytes are never served from a public or guessable URL.
  - **Erasure:** a registration's files are removed by the existing erasure (`buxa_delete_registration_v1`, migration `0054`), because `registration_files` cascades from `registrations`. Withdrawing a registration keeps its files, as it keeps its answers.
  - **Gaps, not closed:** Postgres keeps the old row version of a deleted file until VACUUM reclaims it, and a backup keeps the file until it ages out. Neither is scrubbed by the erasure. A form attachment is not personal data, but a family's document is, and its retention period is not yet defined (see section 6).
  - **Request size:** server actions accept a post of up to 12 MB (`experimental.serverActions.bodySizeLimit` in `apps/web/next.config.ts`), so a few uploads fit in one post. The cap applies to every server action in the app; the 1 MB limit for `/v1` requests (above) still applies to route handlers. Each file is checked against 1 MB by the service.
  - Tests: `apps/server/src/registration/registrationDocuments.test.ts` (in memory) and `apps/server/src/registration/PgRegistrationFiles.pg.test.ts` (Postgres: another camp cannot read or download, a session the form does not cover is refused, a wrong or oversized file is refused, erasure removes the files). The migration test is `packages/db/test/registration-documents-upgrade.pg.test.ts`.
- **Emergency contact (migration `0073`, `docs/phases/03-registration.md`).** A name, phone and optional relationship for an adult to call when a person cannot be reached. Optional for everyone, and not required anywhere yet.
  - **Who can read it:** staff and above (`people:read_contact`), and the family's guardian for their own child. The guardian is recognised by the signed-in email, as the badge rules do: a guardian of a household the child is in. A viewer who is neither sees a line that says who can, and no values. The server sends the values only to those people (`PeopleService.get`).
  - **Who can edit it:** staff with `people:update`, and the family's guardian for their child, who also needs read access to the camp. Nobody can edit it in an archived camp. Another family's guardian, and a viewer with no family link, are refused with 403 (`PeopleService.updateEmergencyContact`, tests in `apps/server/src/services/__tests__/emergencyContact.test.ts`). The permission is checked in the service, not in the page.
  - **Storage and checks:** three nullable columns on `people`. A name and a phone go together; the phone is 7 to 32 characters (its shape is checked by `packages/contracts`); no backfill.
  - **Audit:** each save writes `person.emergency_contact.update` in the same transaction, with the person id and nothing else: no name, phone or relationship. It is not written for a refused change.
  - **Not yet:** the contact is not required at activation, and registration does not read it.
- **Audit log:** every write to people, memberships, badges and attendance is recorded in the same transaction. The log cannot be updated, deleted or truncated by the app role.
- **Authentication:** tokens are verified against Supabase's public keys (ES256 or RS256 only). `none` and shared-secret tokens are rejected. Users are matched by provider id, not email. See `docs/auth.md`.
- **Authorisation:** a permission matrix in `packages/domain` decides every action, server-side. The UI hides controls for convenience only; the server enforces the same rules.
- **Badges:** 128 random bits from a secure random source. The SHA-256 hash is the lookup key at check-in. The token is also stored **encrypted at rest** (AES-256-GCM, a fresh 12-byte IV per badge, the GCM tag checked on every open), so a badge can be shown again. The key is an environment secret, `BADGE_ENCRYPTION_KEY`, read only by the server and never stored in the database or the repository (`docs/deploy.md`). A revoked badge's encrypted copy is wiped at once, so only the active badge of each person holds one. Badges issued before encrypted copies existed show "Reissue to show the badge" until reissued.
  - **Who may show a badge:** admins and owners (`credentials:manage`) for any person; the person themself (matched by the email on their sign-in to their person record in the camp); and a guardian for each child in a household where the guardian is a guardian. Everyone else, staff and viewers included, is refused. The code leaves the server only when someone presses Show or Reprint; it is never in a page's props.
  - **Reprint** (the same code, for a damaged card) is for admins and owners only.
  - **Reissue** (new code, old code revoked) is for a lost card. It shows "Badge reissued." and no code; the new badge is shown with Show badge.
  - **Confirming a registration** issues one badge per camper with no active badge, in the same transaction. Without `credentials:manage` the confirmation issues none and says an admin must.
  - **Audit actions:** `badge.view` (a show, with the actor and the person), `badge.reprint`, `badge.reissue` (a reissue, with the revoked badge it replaced), and `credential.issue` for a first badge. None of them holds the code.
- **Check-in with a family's email (migration 0068, `docs/phases/04-seats-rosters.md`).** The gate has no sign-in, so a code proves the family and a device token keeps the phone verified.
  - **Codes:** six digits, sent only to a registration's guardian email, and only when the email is on file. The answer to a request is the same for a known and an unknown email. A code expires after 10 minutes, allows 5 wrong attempts (the fifth voids it), and a new one waits 60 seconds after the last. A code is stored as a keyed hash bound to its household, and is used once.
  - **Device tokens:** 256 random bits, stored only as a keyed hash, scoped to one camp and one household, and issued only for a code verified in the last five minutes, once. The token lasts until the camp's season end (when that is still ahead) or 180 days. A device works only for its own camp's gate link and its own household's children. Staff with `attendance:record` revoke one; a revoked token stays revoked.
  - **Keys:** every hash is HMAC-SHA256 with `GATE_PEPPER`, a server secret of at least 32 characters in the environment (never in the repository or the database). Without it the gate does not run. Rotating the pepper invalidates every live code and device token, so change it only with the families' re-verification in mind.
  - **Camp link:** a random token, stored as a keyed hash, with an encrypted copy for an admin to show again (the badge cipher, `BADGE_ENCRYPTION_KEY`). An admin (`org:update`) replaces it, and the old link stops working.
  - **Database:** the code table has no grant and no policy for the request role; only definer functions touch it, and each checks the camp, the household and (for the desk) the staff role. The device table is readable by staff of its camp and changed only by revocation (a trigger keeps a revoked device revoked). Device tokens hold no personal data.
  - **Answers:** no message says whether an email is on file; a refusal says the same thing for a wrong, expired, void or unknown code.
  - **Rate limits:** code requests per client address (20 per 10 minutes) and per email (5 per hour); code entries per address (30 per 10 minutes) and per email (20 per 10 minutes). A limited request gets a 429 with the usual wait.
  - **Audit:** each verification (`gate.verify`, with the outcome and no address), code request, device issue and revocation, link rotation, and each child checked in (`attendance.check_in`, `via: gate`) writes its row in the same transaction. The audit rows hold no code, token or email.
  - **Not yet:** email delivery is not configured, so production sends no codes (see the phase document). The gate's check-in does not check a season pass. Tests: `packages/domain/src/gate/rules.test.ts`, `apps/server/src/gate/__tests__/createGateService.test.ts`, `apps/shared/src/gate/entryFlow.test.ts`, and `packages/db/test/camp-gate.pg.test.ts` (Postgres).
- **Web headers:** a per-request Content-Security-Policy with a fresh nonce, plus standard security headers.
- **Inputs:** validated with zod at the boundary; exports neutralise spreadsheet formulas.
- **Pages:** camp pages require a session, and each action checks the actor's role.
- **Rate limits:** fixed windows counted in Postgres (`rate_limits`, migration 0010), so every serverless instance shares them. Each limit is keyed by a hash of the rule and the identity, so no address or user id is stored in the clear. A limited request gets a 429 with `Retry-After` (the server action shows the message in the form). The limits, all in `apps/server/src/rateLimit/limiter.ts`:
  - **Starting a camp** (`POST /v1/orgs` and the camp form): 10 per hour per person. Both paths share the budget. Chosen to allow a camp operator to set up several camps, while stopping a loop of slug and row creation.
  - **Badge scans** (scanner server action): 120 per minute per signed-in person, which allows about one scan every half second. A busy gate scans a person every few seconds, so staff should not reach it in normal use. It bounds scan volume if a session is abused.
  - **Readiness probe** (`GET /ready`): the database check is cached for 5 seconds per instance, so most calls run no query at all. The cache is per instance, and the rate limit of 30 checks per minute per client address applies only when the cache has expired. The client address is the last `X-Forwarded-For` hop, which the platform appends.
  - If the limiter cannot be reached, the probe still answers, and the database check decides.
- **Request bodies:** capped at 1 MB by counting bytes as they are read. A request without a Content-Length is cut off at the same point.
- **Input format:** email and phone are checked for shape in `packages/contracts` (`contact.ts`). A value the database refuses (check constraint, too long, wrong type) is a 400 with a generic message, never a 500 and never the database's own text.
- **Static files:** `_next/static`, `_next/image` and `icon.svg` send `X-Content-Type-Options: nosniff` (from `next.config.ts`, because `proxy.ts` skips them).
- **Local dev server** (`npm run server`, code in `apps/server/src/agents`, not part of the deployed app): it listens on loopback only unless `BUXA_ALLOW_REMOTE_HOST=yes` is set. Every `/api` request must send the run secret in `X-Buxa-Run-Secret`. The server prints a new secret each run, or uses `BUXA_LEGACY_SECRET` (at least 16 characters) if set. The browser reads the same value from `NEXT_PUBLIC_LEGACY_SECRET`. The event stream takes it as a `run_secret` query parameter, because the browser's EventSource cannot send headers.

## 3. Planned, not built

- **Access logging for people records:** who viewed which child's record, and when. Needed before real data.
- **Rate limiting** on the other API endpoints. Camp creation, scanning and the readiness probe are limited (section 2). Supabase limits sign-in attempts.
- **Two-factor sign-in for admins and staff.**
- **Field-level encryption** for sensitive fields such as medical notes (phase 6 or later; medical data is out of scope for now).
- **Error and security monitoring** with a service that alerts on repeated failures.
- **Backups:** automated daily, with point-in-time recovery on a paid plan, and a restore test before launch (see `docs/deploy.md`).
- **Separate environments:** real data only in its own Supabase project and Vercel environment; previews never connect to it.

## 4. Children's data

- Collect only what each phase needs. Phase 1 holds names, date of birth, household links and attendance. It does not hold medical notes, photos or home addresses.
- Consent and notices: a parent or guardian must be told what is stored and why. The consent flow is not built.
- US rules: COPPA and state child-privacy laws apply. A lawyer's review is required before real data is stored.
- The emergency contact is another adult's name and phone, held for the camp's safety. It is kept with the person and erased with them. The adult is not a user of Buxa, so the consent notice must cover them as well as the parent or guardian.
- Family documents (immunization records) are personal data about a child. They are kept with the registration and erased with it (section 2). Their retention period is not yet defined.
- Retention: each record type needs a set period and a deletion process. None is defined yet.
- Access by viewers: viewers see names and roles only. Minor status and contact details are hidden from them.

## 5. Reporting a problem

Report suspected security issues privately to the repository owner. Do not open a public issue. Include the steps to reproduce and what data could be exposed. We aim to acknowledge within two working days.

## 6. Open items before real data (must all be done)

- [ ] Privacy review of children's data (COPPA, state rules), with consent and notice text
- [ ] Retention periods and a deletion process for each record type
- [ ] Access logging for people and attendance records
- [ ] Rate limits on API and scanner endpoints (camp creation, scanning and `/ready` are done; see section 2)
- [ ] Two-factor sign-in for staff and admins
- [ ] Automated backups with a tested restore
- [ ] Separate production Supabase project and Vercel environment
- [ ] Error and security monitoring with alerts
- [ ] External penetration test
- [ ] Secrets review: no keys in the repository or build logs; rotation plan
- [ ] Database login isolation: the runtime login is live and `/ready` answers `ready`; the migration login is only in the deploy job's secret store (section 7)
- [ ] Connection logging and an alert on the migration login are switched on and tested (section 7)

## 7. Database login isolation

Two logins reach the database. The **runtime login** (`DATABASE_URL`) serves requests and has no bypass rights. The **migration login** (`MIGRATION_DATABASE_URL`) changes the schema and can bypass row-level security. The rules below keep the migration login away from the web app and away from the open network. Setup steps are in `docs/deploy.md`.

### 7.1 What the app enforces

- The web app reads only `DATABASE_URL`. If only the migration URL is set, it refuses to start. The migrate command reads only the migration URL, and refuses without it.
- In production, a login that is a superuser, has `BYPASSRLS`, or is a member of a role with either is refused. `/ready` answers 503 and tenant queries fail. See section 2.

### 7.2 Network rules

- Allow database connections only from the deploy job and from the app's own network.
- Restrict the migration login to the deploy job's network range where the host supports it. Supabase restricts the whole database, not one login, so there the rule is applied to the database as a whole and the migration login's protection rests on the credential and on section 7.3. A self-hosted Postgres can restrict a login in `pg_hba.conf`.
- Do not open the direct (non-pooled) port to the internet from the app.
- The steps and the reasons are in `docs/deploy.md`, "Network rules". Nothing here is automated.

### 7.3 Monitoring

- **Log every connection by the migration login.** In Postgres, run once as an admin: `ALTER ROLE <migration login> SET log_connections = on;` and `ALTER ROLE <migration login> SET log_disconnections = on;`. The server log then records each login with its address and time. Some hosts do not let you set this per login; where that is so, enable connection logging for the whole database instead and say so in the deploy log. On Supabase, send the Postgres logs to the project's log explorer (or a log drain you already use), so no new service is needed.
- **Use the migration history as the audit trail.** Every migration applied is a row in `schema_migrations` with its time (`at`). A row with a time outside a deploy window means a schema change happened outside the deploy. Check it after each deploy.
- **Alert on any use outside a deploy.** Alert on any connection by the migration login whose time is outside a deploy job's run, and on any connection from an address that is not the deploy job's. Route the alert to the owner. There is no alerting service in the repository yet (section 3 lists error and security monitoring as planned); until one exists, the owner checks the log explorer after each deploy and weekly.
- **Test the alert once** by connecting with the migration login from outside the deploy job and confirming that the alert fires. Record the date in the deploy log.

### 7.4 Rotation

- **On a schedule:** rotate the migration login's password every 90 days, and the runtime login's every 90 days too. Generate the new value on your machine, store it in the deploy job's secret (migration) or Vercel's form (runtime), then `ALTER ROLE <login> PASSWORD '<new>';`. Deploy, and check `/ready` for the runtime login.
- **After any suspected leak:** rotate both logins at once, the same way, and treat the leak as an incident. Check `pg_stat_activity` and the connection log for the period since the value could have been seen. Then review `schema_migrations` for any change nobody made.
- Never paste a password into a chat, a ticket, a commit or a log. If a value is pasted anywhere, treat it as leaked and rotate it.

### 7.5 The honest limit

If someone gets the migration password and can reach the database, row-level policies do not stop them. The migration login can bypass row-level security by design, because schema changes need it. Row-level security protects tenants from the app's own mistakes and from a leaked runtime login; it does not protect against a leaked migration login. What protects the migration login is:

1. **Credential secrecy:** one secret, in the deploy job only, never in the web environment, a log or a repository.
2. **Network rules** (section 7.2), where the host allows them.
3. **Monitoring and rotation** (sections 7.3 and 7.4), so a misuse is seen and the password stops working.

On a managed host such as Supabase, the owner role (`postgres`) may not be removable, and the app's migration login may be that owner. Then this limit is permanent for that host, and the controls above are the whole defence. Do not describe the database as protected from a stolen migration password while this is the case.

Also, a schema change made by the migration login is not checked by row-level security at all. Review each migration as code.

## 8. Class series and occurrences (v0.4, in progress)

- **Series and days.** `class_series` (migration 0060) is org-scoped with forced row-level security and has no DELETE for the request role. A series is removed only with its session, through the owner's functions. A day (`sessions`) can be cancelled and restored by staff with `classes:manage`. Each change writes `occurrence.cancel` or `occurrence.restore` in the same transaction, with the reason (a short note, no personal data).
- **One place per child per series.** Enforced in the database (migration 0061): a unique index on active enrolments and on active seat holds per series and child, so a child cannot take two places in one series by writing on two days.
- **Overlap across series** is refused by a database check on enrolments (active days only). An admin override with a recorded reason still bypasses it, as before.
- **Not yet:** cancelled days are still shown in the calendar and the check-in list (see `phases/04-seats-rosters.md`), so a cancelled day is not yet hidden from the people who read those lists.
