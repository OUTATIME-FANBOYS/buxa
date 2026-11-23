# Deploying Buxa on Vercel (staging)

One Next.js app: the pages and the `/v1` API are the same deployment on the same address, so there is no cross-origin setup. Vercel builds Next.js natively.
The database and sign-in are Supabase. Staging uses **mock data only**.

## What gets deployed

- Pages and API routes run on Vercel Functions; the browser gets a strict Content-Security-Policy (a fresh nonce per request, set by `apps/web/proxy.ts`),
  no framing, HSTS and the other headers in `apps/web/config/security.ts`.
- `apps/web/vercel.json` sets the build command: `scripts/vercel-build.ts`. It applies database migrations first on a **production** build, then runs `next build`.
  A failed migration fails the build, so the previous deployment keeps serving. **Preview** builds never touch the schema.

Check the production build on your machine first:

```bash
npm run build && npm start        # http://localhost:3000, uses apps/web/.env.local
```

## Settings (Vercel → Project → Settings → Environment Variables)

| Variable                                                           | Environments                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                     | Production, Preview                           | Supabase **session pooler** URI for the **restricted runtime login** (see "Database logins"). The only database URL the web app reads. Never the migration login.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `MIGRATION_DATABASE_URL`                                           | **Production only**                           | The **migration login** (the one that may bypass row-level security). Read only by the migrate command. The web app never reads it. Target: not set here at all (see "Database logins", step 4).                                                                                                                                                                                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all                                           | Public values from Supabase. Publishable key only. The browser and the server read the same two.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `BADGE_ENCRYPTION_KEY`                                             | Production and Preview (marked **Sensitive**) | A secret: 32 random bytes, base64 encoded. Encrypts badge codes at rest so a badge can be shown again. **Required** wherever badges are issued or shown; without it those actions answer with a configuration message, and the rest of the app still runs. Generate it on your machine (for example `openssl rand -base64 32`), paste it into Vercel's form only, and never reuse a value across environments. A new key is not compatible with badges issued under the old key: after a change, reissue each badge. Without it, confirming a registration fails and rolls back. |
| `DB_POOL_MAX`                                                      | all (optional)                                | Connections per function instance (default 10). Use a small number such as `5`: many instances may run at once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `LOG_LEVEL`                                                        | all (optional)                                | Default `info`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

If you connected the Supabase integration, **remove `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET`** from the project's variables. This app never uses them, and a secret that is not there cannot leak.
The integration may also add `NEXT_PUBLIC_SUPABASE_ANON_KEY`; our name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, so set that one explicitly.
Paste secrets only into Vercel's form, never into the repo or a chat.

## Database requirements

- Postgres 15 or newer. Row-level security is how tenants are kept apart, so it is not optional.
- Migrations are the `.sql` files in `packages/db/migrations`, applied in filename order. The current set is `0001` to `0044`. Do not add a migration under a number that is already used.
  There are two logins. They must be different, and the web app must only ever hold the restricted one.
  The names: `buxa_app` is a `NOLOGIN` role that migration `0001` creates; tenant queries switch to it. `buxa_runtime` is the runtime login the operator creates (see "Operator steps"). The migration login is whatever login `MIGRATION_DATABASE_URL` names. On Supabase it may be the owner role (`postgres`), which `docs/security.md` (section 7.5) describes as a permanent limit.

- **Migration login** (`MIGRATION_DATABASE_URL`). Applies migrations. It needs `CREATEROLE` and must be able to bypass row-level security (a superuser, or Supabase's `postgres` role). Migration `0004` lets it switch to `buxa_app`. The three privileged functions from migration `0009` run with its rights, so it keeps that ability. The migrate command (`npm run db:migrate`, `packages/db/src/cli.ts`) reads this URL and nothing else: with only `DATABASE_URL` set it exits with an error. Locally, set `MIGRATION_DATABASE_URL` to the same superuser as `DATABASE_URL` (the docker compose database).
- **Runtime login** (`DATABASE_URL`, production and preview). Serves every request. It must be a member of `buxa_app` and must **not** have `SUPERUSER`, `BYPASSRLS` or `CREATEROLE`. Every tenant query switches to `buxa_app` (`withOrg`). The three cross-organisation paths (the sign-in user row, the sign-in membership lookup, and organisation creation) are `SECURITY DEFINER` functions that only `buxa_app` may run.

The web app never reads `MIGRATION_DATABASE_URL`. If it is the only database URL set, the app refuses to start with a message that says so (`apps/server/src/config.ts`). The migrate command refuses to run without it (`packages/db/src/migrate.ts`, `migrationDatabaseUrl`).

### Startup check: the app refuses a privileged login

On the first request, and on every `/ready` call, the app reads the attributes of the login it connects with (`packages/db/src/connection.ts`, `loginPrivilegesOf`): `SUPERUSER`, `BYPASSRLS`, and membership, direct or indirect, of a role that has either. The result is remembered for each pool, so it costs one query per instance.

- **In production**, a privileged login is refused. `/ready` answers `503 {"status":"unrestricted_login","message":"..."}`, and every tenant query fails (`withOrg`). Nothing is served through that login.
- **In development and tests** the check does not refuse (the local superuser is expected), so local work is not blocked.
- The check never prints the login name, the password or the URL.

### Operator steps: move the app to the restricted login

Do these **in this order**. Before step 3, the new release refuses to serve tenant data through the current migration login, so **do not deploy this release until step 3 has passed.**

1. **Create the runtime login** (once, as the migration login, in the Supabase SQL editor or `psql`). Choose a long random password, generate it on your machine, and keep it in Vercel's form only:

   ```sql
   CREATE ROLE buxa_runtime LOGIN PASSWORD '<long random password>' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
   GRANT buxa_app TO buxa_runtime;
   ```

2. **Check the attributes and memberships** (all must be false or `buxa_app` only):

   ```sql
   SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = 'buxa_runtime';  -- all three must be false
   SELECT roleid::regrole FROM pg_auth_members WHERE member = 'buxa_runtime'::regrole;         -- only buxa_app
   ```

3. **Move `DATABASE_URL` to the runtime login.** Build the URL from the session pooler with that login (on Supabase the user name is `buxa_runtime.<project-ref>`). Set it for Production and Preview, then redeploy. Check the startup check passed:

   ```bash
   curl -s https://<address>/ready   # expect {"status":"ready"}
   ```

   Then sign in and open a camp page.

4. **Take `MIGRATION_DATABASE_URL` out of the web environment** (target state). It belongs only to the deploy job's secret store (see "Deploy job and secrets" below). Until that is done, Production still holds the migration URL, which the web app does not read, but which a Vercel function could read.

**If `/ready` answers `503 unrestricted_login`:**

- Do not switch `DATABASE_URL` back to the migration login to get the site up. That is the state this change exists to end.
- Run the query in step 2 again and read the answer. If `buxa_runtime` has `SUPERUSER` or `BYPASSRLS`, run `ALTER ROLE buxa_runtime NOSUPERUSER NOBYPASSRLS;`. If it is a member of a role other than `buxa_app` that has them, run `REVOKE <that role> FROM buxa_runtime;`. Then redeploy and check `/ready` again.
- If the site must come back before that is fixed, promote the **previous** deployment (Vercel → Deployments → Promote to Production). The previous release runs without this check, so it works with either login. Record the reason in the PR that fixes it, and treat it as a security incident, because tenant data was served through a privileged login until then.
- `503 unavailable` (not `unrestricted_login`) means the database itself cannot be reached. The login check is not the cause; look at the connection string and the pooler.

The code path is covered by `apps/server/src/users/__tests__/runtimeLogin.pg.test.ts`, which runs the sign-in and organisation repositories through a login with these attributes. `packages/db/test/login-privileges.pg.test.ts` tests the check itself against real logins, with and without `BYPASSRLS`, and through a membership.

### Deploy job and secrets

- The migration login lives in **one secret**, used only by the job that applies migrations. Today that job is the Vercel production build (`scripts/vercel-build.ts`), so until it moves, the value is also in Vercel's Production variables. The target is a GitHub environment secret (for example `MIGRATION_DATABASE_URL` in a protected `production` environment) read only by a `npm run db:migrate` step in the deploy workflow, with the Vercel production build no longer applying migrations. That change touches `scripts/vercel-build.ts`, `apps/web/vercel.json` and `.github/workflows/ci.yml`, and it is not made yet.
- Do not copy the migration URL into the web environment, a `.env` file under `apps/web`, a log, a chat or a repository. Preview builds never have it.
- The migration secret must not be in any environment the web app runs in. If you change how migrations run, check that `vercel env ls` (or the Vercel dashboard) no longer lists it for Production.

- Use Supabase's **Session pooler** connection string (Project Settings → Database → Connection string). Vercel connects over IPv4, and the direct
  connection is IPv6-only on the free plan; session mode also supports the advisory lock migrations use.
- **URL form:** `postgresql://<user>:<password>@<pooler host>:<port>/<database>` (`postgres://` works too). The app refuses any other scheme. Never paste the URL into the repo, a chat or a log.
- **TLS:** a database on any host other than `localhost`, `127.0.0.1` or `::1` is always connected with TLS. The server certificate is checked against the Supabase root CA in `packages/db/src/supabaseRootCa.ts`. The same certificate is in `packages/db/certs/supabase-root-2021-ca.crt`, and a test keeps the two equal. Any `sslmode` in the URL is removed, so it cannot weaken that check. Local databases use no TLS.
- CI runs the database and server tests as a non-superuser to catch anything that only works for a superuser.

### Network rules (operator steps; nothing here is automated)

The rules are: **the database accepts connections only from the deploy job and from the app's own network, and the migration login is used from the deploy job's network only.** Apply them as far as the host allows. Where a host cannot express a rule, rely on the credential and the monitoring in `docs/security.md`, section 7, and write down which rule you could not apply.

1. **Restrict the database to the app's network.** Supabase: Project Settings → Database → Network Restrictions, add the allowed IPv4 ranges. Vercel's functions use shared, changing addresses unless the project has a static outbound IP (Secure Compute on Enterprise). If the app has no fixed range, leave the restriction open to the pooler and say so in the release notes; the credential is then the control.
2. **Restrict the migration login to the deploy job's range.** Supabase restricts the whole database, not one login, so on Supabase this rule cannot be applied per login. A self-hosted Postgres can do it in `pg_hba.conf` (`hostssl buxa_migrator ... <deploy-runner-cidr>`). A hosted GitHub Actions runner has changing addresses, so the deploy job's range is not fixed either; if you need a fixed range, run the migration step on a self-hosted runner with a fixed address.
3. **Do not expose the direct (non-pooled) connection** to the internet from the app. The app uses the session pooler (`docs/deploy.md`, "Database requirements").
4. **Check the rule once a month**: open the Network Restrictions page and the `pg_hba.conf` (if you run your own Postgres) and compare them with this list.

## How a deploy works

1. Push or merge to `develop` (staging) or `main`. CI runs first (`.github/workflows/ci.yml`). After **Verify build** passes on a push, the **Deploy to Vercel** job calls the Vercel deploy hook for that branch. The hooks are the repository secrets `VERCEL_DEVELOP_DEPLOY` and `VERCEL_MAIN_DEPLOY`; a missing secret fails the job. Pull requests do not call the hook.
2. Vercel builds `apps/web` (the Root Directory) with `scripts/vercel-build.ts`. The repository sets no ignored build step (`apps/web/vercel.json` has no `ignoreCommand`). Any rule that skips builds would have to be set in the Vercel project, and none is set in the repository.
3. A **production** build applies pending migrations first (each migration is one transaction, so nothing is half-applied), then builds the app. Preview and other builds never touch the schema.
4. Pull requests get a **preview** deployment at their own address, against the same database but never migrating it: a PR that adds a migration will not see its new tables in the preview until it is merged. Test those locally.
5. After a deploy, check `<address>/ready` (expect `{"status":"ready"}`), then sign in.

## Badge encryption key (migration 0041)

Migration `0041` adds an encrypted copy of each active badge's token (`credentials.token_ciphertext`, `token_iv`, `token_auth_tag`). The key that seals them is `BADGE_ENCRYPTION_KEY`, read only by the server when a badge is issued or shown (`apps/server/src/credentials/badgeCipher.ts`). Set it in Production and in Preview, and mark it Sensitive in Vercel's form, before the first badge is issued there. Badges issued before `0041` have no copy: the camp reissues them to show them. Do not put the value in a repository, a log or a chat.

## Preferred name removal (migration 0044)

Migration `0044` clears every stored preferred name and drops `people.preferred_name` (release `v0.3.2`, the `drop-approved` label). A person is shown by first name and family name only. Releases before `v0.3.2` still select the column, so do not run `0043` against a database that a build older than `v0.3.2` is serving.

## Phase 3 migrations (0023 to 0040)

Migrations `0023` to `0040` add registration forms and registrations, session prices, seat holds, the teacher role and its assignments and options, the calendar feeds, public session pages, confirmation, notifications, the session delete guard, teacher invites, owner role changes and owner person delete. Each is one transaction, and a production build applies them in order, as described above.

- **Expand and contract for session membership.** `0032` only adds functions. `0034` drops the older owner-rights overloads, including `buxa_memberships_of(uuid)`, and requires a signed-in member in every row policy. The migration's header says the v0.2.3 release still calls those overloads and is not serving anywhere, so do not run v0.2.3 against a database where `0034` has run. Whether `0034` has run on production is not confirmed in the repository.
- **Org name and time zone** (`0036`) change the row policy so only an admin or the owner may update the camp row.
- **Session delete** (`0035`) refuses, in the database, to delete a session that still holds classes.
- **Teacher invites** (`0038`) add `member_invites`, which stores only a SHA-256 hash of each token, and `users.phone`. The request role has no DELETE on invites. Three definer functions handle accepting an invite and the profile, and take the signed-in user from `current_user_id()`.
- **Role change** (`0039`) adds `buxa_change_member_role`, the one write path for a member's role. It refuses a change to one's own role, keeps at least one owner, and lets only the owner make or remove an owner. It writes `member.role_change`.
- **Person delete** (`0040`) adds `buxa_delete_person`, owner only. It removes the person (linked rows cascade), removes pending teacher invites sent to that email, and writes `person.delete` without the person's details.

## Migration 0022: sessions and classes

`0022_sessions_parent_classes.sql` gives sessions a date range and classes a time range, and backfills existing rows in the camp's time zone. It is expand only: nothing is dropped, and its drop guard check passes without an approval line.

- **Risk while both releases run.** During a deploy the old release is still serving. Sessions that the new release creates have no default capacity, and the old classes list may fail to render them until the old release is gone. Run this deploy in a quiet window and keep the two releases side by side for as short a time as possible.
- **Nothing is lost.** The old release keeps working on the migrated schema. Rolling back the application does not undo the migration; the rows that the new release wrote stay in the database.
- The full data model and the list of what is and is not done are in `docs/plans/sessions-classes.md`.

## Setting it up (you do these; they need your accounts)

1. **Supabase, email confirmation.** Authentication → Providers → Email: keep **Confirm email** ON. The server reads this setting on first use. In production, if sign-ups are auto-confirmed, the **API answers 503** on every route and the **app shows a maintenance page** (no sign-in, sign-up or camp pages), so nobody can register with an address they do not own. If the check cannot run, it logs a warning and carries on.
2. **Supabase, signing keys.** Project Settings → JWT Keys: an asymmetric (ECC/RSA) signing key must be current.
3. **Vercel.** Add New → Project → import `OUTATIME-FANBOYS/buxa`. Set **Root Directory** to `apps/web` and keep **Include source files outside of the Root Directory** on (the shared packages live in `packages/`). `apps/web/vercel.json` does the rest. Add the environment variables above before the first build. Then Settings → Git → Production Branch: `develop`.
4. **Region.** Settings → Functions → pick the region closest to your Supabase project, to keep database round trips short.
5. **Supabase, sign-in links.** Authentication → URL Configuration: set **Site URL** to the Vercel address, and add `https://*.vercel.app/**` (or your team's preview pattern) to Redirect URLs so preview sign-ups work.
6. **Optional hardening.** Supabase → Settings → Data API: turn it off. Migration `0005` already removes its access to our tables.
7. **Deploy hooks.** In the Vercel project, Settings → Git → Deploy Hooks: create one hook for `develop` and one for `main`. Save the two URLs as the GitHub repository secrets `VERCEL_DEVELOP_DEPLOY` and `VERCEL_MAIN_DEPLOY`. The URLs are secrets: paste them only into GitHub's form.

**Not yet verified on Vercel itself:** the Root Directory and outside-source settings above, and the build command. Tested locally: all three build modes (preview skips migrations, production applies them first, production without a credential fails before building) and the production server with the full browser flows. The first deploy is the real check.

**Plan.** From memory, Vercel's free Hobby plan is for personal, non-commercial use; a camp business should be on Pro. Check Vercel's current terms.

## Rolling back

- **Application:** Vercel → Deployments → choose the previous deployment → **Promote to Production**. It is instant and exact.
- **Database:** migrations only go forward. To keep rollbacks safe, every migration must work with **both** the new and the previous application version (add a column or table first, switch the code, remove the old thing in a later release). Never edit a migration that has been applied; add a new one.
- **Bad data or a bad migration:** restore from a backup into a new database and point the app at it. Turn on backups before any real data exists (on Supabase: daily backups, and point-in-time recovery on paid plans). Test a restore once.
- Record what you did in the PR that fixes it.

## Before real users (this checklist gates the first release, not staging)

- [ ] Backups enabled and one restore tested
- [ ] A separate Supabase project and Vercel environment for real data; previews must never touch it
- [ ] Rate limits on the remaining API routes (camp creation, badge scans and `/ready` are limited by migration `0010`; see `docs/security.md`, section 2)
- [ ] Privacy and compliance review for children's data (consent, retention, encryption, access logging)
- [ ] Error tracking and uptime alerting
- [ ] Multi-factor authentication for staff
