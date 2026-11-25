# Authentication (Supabase)

Supabase owns sign-up, passwords, email verification and sessions. The API never sees a password: it checks the
signed access token a browser sends as `Authorization: Bearer <token>`.

## How a request is trusted

1. Signature is checked against the project's public keys (`<NEXT_PUBLIC_SUPABASE_URL>/auth/v1/.well-known/jwks.json`).
   Only ES256/RS256 are accepted; `none` and shared-secret tokens are rejected.
2. Issuer must be `<NEXT_PUBLIC_SUPABASE_URL>/auth/v1`, audience `authenticated`, and the token must not be expired.
3. The user is found by the provider's user id (never by email), or created on first sign-in.
4. The organisation comes from the `x-org-id` header and is honoured only if the user is a member.
   Unknown and forbidden organisations get the same 403 so ids can't be probed.
5. The role in that organisation is checked with `authorize()` (`packages/domain`), then data is read through
   `withOrg()` so row-level security applies as well.

## Set up Supabase

1. In the Supabase dashboard: **Project Settings → JWT Keys**, make sure an asymmetric (ECC/RSA) signing key is current.
   Projects still on the legacy shared secret must migrate; the API deliberately does not accept shared-secret tokens.
2. Copy the project URL (**Project Settings → API**) into `apps/web/.env.local` as `NEXT_PUBLIC_SUPABASE_URL` (with the publishable key as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Both are public. The browser and the server read the same two values.
3. Do not put the service-role key anywhere in this repo. The API does not need it.

## Try it

```bash
npm run db:migrate && npm run dev
TOKEN=...   # a user's access token from your app, or:
# curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: <anon key>" \
#      -H 'content-type: application/json' -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token
curl -s localhost:5173/v1/me -H "authorization: Bearer $TOKEN"
curl -s -X POST localhost:5173/v1/orgs -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"name":"My Camp","slug":"my-camp"}'
curl -s localhost:5173/v1/org -H "authorization: Bearer $TOKEN" -H "x-org-id: <id from above>"
```

## Sample accounts

There are no browser-only accounts and no shared demo password. Sample accounts for each persona will come from a later seed step that creates real Supabase accounts; until then, sign up with a real email address.

## Endpoints (v1)

| Route             | Needs                  | Does                                          |
| ----------------- | ---------------------- | --------------------------------------------- |
| `GET /v1/me`      | token                  | Your user and the organisations you belong to |
| `POST /v1/orgs`   | token                  | Create an organisation; you become its owner  |
| `GET /v1/org`     | member, `org:read`     | The selected organisation                     |
| `PATCH /v1/org`   | admin+, `org:update`   | Rename it (audited)                           |
| `GET /v1/members` | member, `members:read` | Members of the selected organisation          |

## Roles and permissions

Each login has one **organization access** level in a camp: **viewer**, **staff**, **admin** or **owner**. They form a ladder: a higher level has everything the lower ones have. The keys, labels and order are defined once, in `packages/domain/src/roles/roles.ts`. The agreed rules are in `docs/ROLES.md`, the first place to read before changing any role. There is no teacher access level. Teaching is the **instructor** person role, which is separate: a viewer whose person holds it gets the teaching view (below). The grant matrix is `packages/domain/src/permissions.ts`. Services check it on every read and write, and the screens only hide controls.

| Area                                              | Viewer                          | Staff                              | Admin                                                         | Owner                                                                                          |
| ------------------------------------------------- | ------------------------------- | ---------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Check-in and on site (`attendance:*`)             | none                            | read, record                       | also override and export                                      | as admin                                                                                       |
| People (`people:*`, memberships, badges)          | read people, no contact details | also read contacts, create, update | also archive, authorise pickup, manage memberships and badges | as admin, and delete a person (owner only)                                                     |
| Classes and events (`classes:manage`, `events:*`) | read events                     | manage classes                     | also create, update and delete events                         | as admin                                                                                       |
| Staff board (`tasks:*`)                           | read                            | create, edit, move and comment     | also delete tasks and manage boards                           | as admin                                                                                       |
| Team (`members:*`)                                | read members, leave             | as viewer, and invite people       | also read contacts, invite people, change roles               | as admin, and make or remove an owner                                                          |
| Camp (`org:*`, `audit:read`, `data:*`)            | read the camp                   | as viewer                          | also rename the camp and read the audit log                   | also delete the camp (owner), archive and unarchive it. Transfer, export and erase are planned |

Showing a badge is wider than this table: the person themself, and a guardian of a child in their household, may also show it (see `docs/security.md`, section 2). Issuing, reprinting, reissuing and revoking stay with `credentials:manage`.

The teaching view is not in this table. A viewer whose person holds the instructor role sees only the classes it is assigned to and the people in them, and can rename its own classes. It records check-in and check-out only when an admin turns on that option for it (`member_options`, migration `0030`). It has no People, Team access, Work or Admin screens, and teaching gives it no staff or admin right.

The full category table, with what is built and what is planned, is in `docs/phases/03-registration.md`.

**Built:** the class assignments and the per-person options (migrations `0027` and `0030`), invites by email for viewer access with the instructor role (migration `0038`, as changed by `0069`), the retirement of the teacher access level into viewer access plus the instructor role (migration `0069`), changing a member's role on Manage access (migration `0039`, owner-only changes to owners), deleting a person (owner only, migration `0040`), and renaming, archiving, unarchiving and deleting a camp in Settings. Rename and archive are for admins and the owner; delete is for the owner only, from the Danger zone.

An invite is sent from Add person with the Instructor role. The invited person opens the link, signs in with the same email, and joins with viewer access and the instructor role. Invites for the other roles show "Invites for this role are coming soon." Sign-up confirmation is not working end to end yet, so that sign-in step is blocked for a new account (see "Known limits").

**Planned, not built:**

- **Transfer ownership, the audit-log screen, and exporting or erasing a camp's data** (`org:transfer_ownership`, `audit:read`, `data:export`, `data:erase`). Erase is owner-only and no code for it exists yet. Phase 0 requires that deleting an organisation still works while audit rows stay append-only.
- **Invitations for other roles, and removing a member.** Only instructor invites exist. `members:remove` has no screen or service yet.
- **Team access expiry** (a time limit on a person's access to a camp) is built, migration `0043`: an expired membership is refused on the server, as a non-member. See `docs/security.md` and `docs/phases/03-registration.md`. (The valid, expired and not-yet-started status of a person's season membership is built; see `docs/phases/01-members-checkin.md`.)

**What the database enforces, and what it does not.** The matrix is enforced in the app, and since migrations `0057` and `0058` the database repeats it for a few tables: `audit_log` reads (admin, owner), `credentials` writes (admin, owner) with the badge ciphertext unreadable by the app role, the camp calendar token (admin, owner), `member_options` and `notifications` (membership required). A camp admin's rename of a member changes the camp's roster name (`people`), not the login's name (`users`). Every other table, including people and enrolment writes, is still app-only: a role-aware policy for them is the next step, to be added with tests for every role. See `docs/security.md`.

## Code map

`apps/web/app/v1/*/route.ts` (thin) → `apps/server/src/http/route.ts` (request id, authentication, error shape, logging) → `apps/server/src/services/` (permissions, then storage)
→ `apps/server/src/orgs/` and `apps/server/src/users/` (repository interface + Postgres adapter) → `@buxa/db`. Every response shape is defined once in `packages/contracts`.
`GET /v1/org` returns `{ id, name, slug, createdAt, memberCount, timezone, clockFormat }`.

## Known limits (to fix before release)

- Rate limits cover starting a camp (`POST /v1/orgs` and the camp form, 10 an hour per person), badge scans and `/ready` (migration `0010`, `apps/server/src/rateLimit/limiter.ts`). Sign-in attempts are limited by Supabase. Other API routes have no limit yet (see `docs/security.md`, section 3).
- The sign-in user row and membership lookup run as `SECURITY DEFINER` functions (`buxa_upsert_user`, `buxa_memberships_of`, migration `0009`), called as `buxa_app`. They do not need a login that bypasses row-level security. The runtime login itself is still to be set up as `docs/deploy.md` describes.
- Session membership (migrations `0032` and `0034`) moves the signed-in user out of the function arguments: the functions read it from `current_user_id()`, which `withOrg` sets. Migration `0034` (the contract step) drops the older overloads that took a user id, including the `buxa_memberships_of(uuid)` form. Whether `0034` has run on production is not confirmed in the repo (see `docs/security.md`, section 2).
- Email verification relies on Supabase's "Confirm email" setting, not on a claim in the token (`user_metadata` is user-editable, so `email_verified` there proves nothing). In production, if that setting is off, the API answers 503 on every route and the app shows a maintenance page instead of its pages and forms (checked on first use, not at process start). Revisit when invitations link people by email.
- `org_members` is read-only for request handling (migration `0006`); the only write path is organisation creation, through the `buxa_create_org` function. Member-management routes must add narrow write policies, not widen the read one.
- Multi-factor authentication for staff accounts that see children's data is not enforced yet.
- **Sign-up email confirmation does not work end to end yet.** The sign-up call (`apps/server/src/composers/auth/signUp.ts`) sets no `emailRedirectTo`, and the app has no `/auth` route that exchanges the emailed link. The link therefore does not finish in this app. Fix the code and the dashboard together (see the next section).

## Sign-up confirmation: the gap and the fix

Code still to write: an `apps/web/app/auth/confirm/route.ts` that reads `token_hash` and `type` from the URL and calls `verifyOtp`, and a `signUp` call that passes `options.emailRedirectTo` pointing at that route. Then, in the Supabase dashboard (you do these; they need your project):

1. **Authentication, URL Configuration, Site URL:** the address of the deployed app (for local work, the local dev address).
2. **Authentication, URL Configuration, Redirect URLs:** add `<app address>/auth/confirm`, with the same host as the Site URL.
3. **Authentication, Email Templates, Confirm signup:** make the link carry the token hash, not the default link:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`

Keep "Confirm email" on (see the limit above). Do not put the project URL or any key in the repo while you do this.

## In the browser: cookie sessions

The browser never holds a token. Sign-in, sign-up and sign-out are Server Actions (`apps/web/actions/auth.ts`, with the composers in `apps/server/src/composers/auth/`); Supabase's session lives in **HttpOnly cookies**
(`@supabase/ssr`, with HttpOnly forced on every cookie), so a script that got into the page cannot read it. `proxy.ts` refreshes the session on each request.
Pages are Server Components: `apps/server/src/session` (`getSession`, `requireSession`, `getCurrentCamp`) reads the access token from the cookie and verifies it with
**our** verifier (the same one the bearer API uses; one definition in `apps/server/src/auth/sessionFromToken.ts`), so a tampered or expired cookie means signed out.
The selected camp is an HttpOnly `buxa-camp` cookie, checked against the person's memberships on every request. Changes go through Server Actions, which Next.js
protects with an origin check. `/v1` stays bearer-token only (for non-browser clients), so cookies never authenticate the REST API and it has no CSRF surface.
Tested in a real browser: every session cookie is HttpOnly and SameSite Lax, no Supabase session token is in local or session storage, a forged camp cookie is ignored, and tampered or garbage session cookies lead to sign-in.
The page also ships a strict Content-Security-Policy (a fresh nonce per request, no inline scripts without it, no framing).
