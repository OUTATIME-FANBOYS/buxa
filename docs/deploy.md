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
| Variable | Environments | Notes |
|---|---|---|
| `DATABASE_URL` | Production, Preview | Supabase **session pooler** URI (see below). Used by the API at runtime. |
| `MIGRATION_DATABASE_URL` | **Production only** | Same URI. Used only by production builds to apply migrations. Keeping it out of Preview means a preview build can never change the schema. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all | Public values from Supabase. Publishable key only. The browser and the server read the same two. |
| `DB_POOL_MAX` | all (optional) | Connections per function instance (default 10). Use a small number such as `5`: many instances may run at once. |
| `LOG_LEVEL` | all (optional) | Default `info`. |

If you connected the Supabase integration, **remove `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET`** from the project's variables. This app never uses them, and a secret that is not there cannot leak.
The integration may also add `NEXT_PUBLIC_SUPABASE_ANON_KEY`; our name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, so set that one explicitly.
Paste secrets only into Vercel's form, never into the repo or a chat.

## Database requirements
- Postgres 15 or newer. Row-level security is how tenants are kept apart, so it is not optional.
- The login that runs migrations needs `CREATEROLE` and must be able to bypass row-level security (a superuser, or Supabase's `postgres` role).
  Migration `0004` grants it the right to switch to the restricted `buxa_app` role.
- If the app connects as a **different** login than the migration login, run once: `GRANT buxa_app TO <app_login>;`.
- Use Supabase's **Session pooler** connection string (Project Settings → Database → Connection string). Vercel connects over IPv4, and the direct
  connection is IPv6-only on the free plan; session mode also supports the advisory lock migrations use.
- CI runs the database and server tests as a non-superuser to catch anything that only works for a superuser.

## How a deploy works
1. Push or merge to the production branch (set it to `develop` while this is staging). Vercel runs the build command.
2. A **production** build applies pending migrations first (each migration is one transaction, so nothing is half-applied), then builds the app.
3. Pull requests get a **preview** deployment at their own address, against the same database but never migrating it: a PR that adds a migration will not see its new tables in the preview until it is merged. Test those locally.
4. After a deploy, check `<address>/ready` (expect `{"status":"ready"}`), then sign in.

## Setting it up (you do these; they need your accounts)
1. **Supabase, email confirmation.** Authentication → Providers → Email: keep **Confirm email** ON. The server reads this setting on first use and **refuses to serve** (503) in production if sign-ups are auto-confirmed, so nobody can register with an address they do not own. If the check cannot run, it logs a warning and carries on.
2. **Supabase, signing keys.** Project Settings → JWT Keys: an asymmetric (ECC/RSA) signing key must be current.
3. **Vercel.** Add New → Project → import `OUTATIME-FANBOYS/buxa`. Set **Root Directory** to `apps/web` and keep **Include source files outside of the Root Directory** on (the shared packages live in `packages/`). `apps/web/vercel.json` does the rest. Add the environment variables above before the first build. Then Settings → Git → Production Branch: `develop`.
4. **Region.** Settings → Functions → pick the region closest to your Supabase project, to keep database round trips short.
5. **Supabase, sign-in links.** Authentication → URL Configuration: set **Site URL** to the Vercel address, and add `https://*.vercel.app/**` (or your team's preview pattern) to Redirect URLs so preview sign-ups work.
6. **Optional hardening.** Supabase → Settings → Data API: turn it off. Migration `0005` already removes its access to our tables.

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
- [ ] Rate limiting on sign-in-adjacent routes and `POST /v1/orgs`
- [ ] Privacy and compliance review for children's data (consent, retention, encryption, access logging)
- [ ] Error tracking and uptime alerting
- [ ] Multi-factor authentication for staff
