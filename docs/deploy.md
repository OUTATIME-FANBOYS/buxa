# Deploying Buxa (staging)

One container serves the web app and the API on one origin, so there is no cross-origin setup. It needs a Postgres
database and a Supabase project (for sign-in). Staging uses **mock data only**.

## What runs
`Dockerfile` builds the web app and bundles the API (`dist-api/`), then runs as the non-root `node` user.
`docker-entrypoint.sh` optionally migrates, then starts the server. `GET /health` is liveness, `GET /ready` checks the database.

## Settings
| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | runtime | Postgres URL the app uses. Through a connection pooler is fine. |
| `MIGRATION_DATABASE_URL` | runtime (optional) | A **direct** connection used only for migrations (a transaction-mode pooler cannot hold the advisory lock). Defaults to `DATABASE_URL`. |
| `SUPABASE_URL` | runtime | Project URL. The API verifies tokens against its public keys. |
| `RUN_MIGRATIONS` | runtime | `true` applies pending migrations before the server starts. |
| `PORT`, `HOST` | runtime | Defaults 8788 / 0.0.0.0 in the image. Most platforms set `PORT`. |
| `LOG_LEVEL` | runtime | Default `info`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | **build** args | Public values baked into the web bundle. Publishable key only; never a secret or `service_role` key. |

## Database requirements
- Postgres 15 or newer. Row-level security is how tenants are kept apart, so it is not optional.
- The login that runs migrations needs `CREATEROLE` and must be able to bypass row-level security (a superuser, or Supabase's
  `postgres` role). Migration `0004` grants it the right to switch to the restricted `buxa_app` role.
- If the app connects as a **different** login than the migration login, run once: `GRANT buxa_app TO <app_login>;`.
- CI runs the database and API tests as a non-superuser to catch anything that only works for a superuser.

## Deploying
1. Merge to `develop`; CI must be green (it builds the image).
2. Build: `docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... -t buxa:<git-sha> .`
3. Run the new version with `RUN_MIGRATIONS=true`. If a migration fails the container exits non-zero, the platform keeps the
   previous version serving, and nothing is half-applied (each migration is one transaction).
4. Check `GET /ready`, then sign in and open the overview.

Try it locally against any Postgres:
```bash
docker run --rm -p 8788:8788 -e DATABASE_URL=postgres://... -e SUPABASE_URL=https://<ref>.supabase.co -e RUN_MIGRATIONS=true buxa:<tag>
```

## Rolling back
- **Application:** redeploy the previous image tag. Images are immutable, so this is exact.
- **Database:** migrations only go forward. To keep rollbacks safe, every migration must work with **both** the new and the
  previous application version (add a column or table first, switch the code, remove the old thing in a later release).
  Never edit a migration that has been applied; add a new one.
- **Bad data or a bad migration:** restore from a backup into a new database and point the app at it. Turn on backups before any
  real data exists (on Supabase: daily backups, and point-in-time recovery on paid plans). Test a restore once.
- Record what you did in the PR that fixes it.

## Before real users (this checklist gates the first release, not staging)
- [ ] Backups enabled and one restore tested
- [ ] Rate limiting on sign-in-adjacent routes and `POST /v1/orgs`
- [ ] Privacy and compliance review for children's data (consent, retention, encryption, access logging)
- [ ] Error tracking and uptime alerting
- [ ] Multi-factor authentication for staff
