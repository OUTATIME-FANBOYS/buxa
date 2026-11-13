# Authentication (Supabase)

Supabase owns sign-up, passwords, email verification and sessions. The API never sees a password: it checks the
signed access token a browser sends as `Authorization: Bearer <token>`.

## How a request is trusted
1. Signature is checked against the project's public keys (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`).
   Only ES256/RS256 are accepted; `none` and shared-secret tokens are rejected.
2. Issuer must be `<SUPABASE_URL>/auth/v1`, audience `authenticated`, and the token must not be expired.
3. The user is found by the provider's user id (never by email), or created on first sign-in.
4. The organisation comes from the `x-org-id` header and is honoured only if the user is a member.
   Unknown and forbidden organisations get the same 403 so ids can't be probed.
5. The role in that organisation is checked with `authorize()` (`packages/domain`), then data is read through
   `withOrg()` so row-level security applies as well.

## Set up Supabase
1. In the Supabase dashboard: **Project Settings → JWT Keys**, make sure an asymmetric (ECC/RSA) signing key is current.
   Projects still on the legacy shared secret must migrate; the API deliberately does not accept shared-secret tokens.
2. Copy the project URL (**Project Settings → API**) into `.env` as `SUPABASE_URL`. It is public, not a secret.
3. Do not put the service-role key anywhere in this repo. The API does not need it.

## Try it
```bash
npm run db:migrate && npm run api
TOKEN=...   # a user's access token from your app, or:
# curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: <anon key>" \
#      -H 'content-type: application/json' -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token
curl -s localhost:8788/v1/me -H "authorization: Bearer $TOKEN"
curl -s -X POST localhost:8788/v1/orgs -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"name":"My Camp","slug":"my-camp"}'
curl -s localhost:8788/v1/org -H "authorization: Bearer $TOKEN" -H "x-org-id: <id from above>"
```

## Endpoints (v1)
| Route | Needs | Does |
|---|---|---|
| `GET /v1/me` | token | Your user and the organisations you belong to |
| `POST /v1/orgs` | token | Create an organisation; you become its owner |
| `GET /v1/org` | member, `org:read` | The selected organisation |
| `PATCH /v1/org` | admin+, `org:update` | Rename it (audited) |
| `GET /v1/members` | member, `members:read` | Members of the selected organisation |

## Code map
`apps/api/src`: `auth/` (verifier, authentication hook, org scope) → `routes/` (one file per resource) → `orgs/` and `users/`
(repository interface + Postgres adapter) → `@buxa/db`. Routes only parse, authorize, call a repository and return.
`GET /v1/org` returns `{ id, name, slug, createdAt, memberCount }`; every response shape is defined once in `packages/contracts`.

## Known limits (to fix before release)
- No rate limiting yet (sign-in is Supabase's; our endpoints need limits, especially `POST /v1/orgs`).
- The sign-in lookup uses the privileged database connection, which must be able to bypass row-level security
  (true for a superuser and for Supabase's `postgres` role). Revisit with a dedicated function when we deploy.
- Email-verified status is not checked yet; it matters once invitations link people by email.
- Multi-factor authentication for staff accounts that see children's data is not enforced yet.

## In the browser
The web app signs in with `@supabase/supabase-js` (publishable key only, never a secret key) and sends the access token to `/v1/*`
through the dev server's proxy. Supabase keeps the session in this browser's local storage and refreshes it automatically; on a 401
the client refreshes once and retries, then asks the person to sign in again. Because the token lives in local storage, any script
injection could read it, so keep third-party scripts out of the app and add a Content-Security-Policy before release.
