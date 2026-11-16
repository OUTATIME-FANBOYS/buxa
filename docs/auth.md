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

## Endpoints (v1)
| Route | Needs | Does |
|---|---|---|
| `GET /v1/me` | token | Your user and the organisations you belong to |
| `POST /v1/orgs` | token | Create an organisation; you become its owner |
| `GET /v1/org` | member, `org:read` | The selected organisation |
| `PATCH /v1/org` | admin+, `org:update` | Rename it (audited) |
| `GET /v1/members` | member, `members:read` | Members of the selected organisation |

## Code map
`apps/web/server`: `app/v1/*/route.ts` (thin) → `http/route.ts` (request id, authentication, error shape, logging) → `services/` (permissions, then storage)
→ `orgs/` and `users/` (repository interface + Postgres adapter) → `@buxa/db`. Every response shape is defined once in `packages/contracts`.
`GET /v1/org` returns `{ id, name, slug, createdAt, memberCount }`.

## Known limits (to fix before release)
- No rate limiting yet (sign-in is Supabase's; our endpoints need limits, especially `POST /v1/orgs`).
- The sign-in lookup uses the privileged database connection, which must be able to bypass row-level security
  (true for a superuser and for Supabase's `postgres` role). Revisit with a dedicated function when we deploy.
- Email verification relies on Supabase's "Confirm email" setting, not on a claim in the token (`user_metadata` is user-editable, so `email_verified` there proves nothing). The API refuses to start in production if that setting is off. Revisit when invitations link people by email.
- `org_members` is read-only for request handling (migration `0006`); the only write path is organisation creation on the privileged connection. Member-management routes must add narrow write policies, not widen the read one.
- Multi-factor authentication for staff accounts that see children's data is not enforced yet.

## In the browser: cookie sessions
The browser never holds a token. Sign-in, sign-up and sign-out are Server Actions (`features/auth`); Supabase's session lives in **HttpOnly cookies**
(`@supabase/ssr`, with HttpOnly forced on every cookie), so a script that got into the page cannot read it. `proxy.ts` refreshes the session on each request.
Pages are Server Components: `server/session` (`getSession`, `requireSession`, `getCurrentCamp`) reads the access token from the cookie and verifies it with
**our** verifier (the same one the bearer API uses; one definition in `server/auth/sessionFromToken.ts`), so a tampered or expired cookie means signed out.
The selected camp is an HttpOnly `buxa-camp` cookie, checked against the person's memberships on every request. Changes go through Server Actions, which Next.js
protects with an origin check. `/v1` stays bearer-token only (for non-browser clients), so cookies never authenticate the REST API and it has no CSRF surface.
Tested in a real browser: every session cookie is HttpOnly and SameSite Lax, nothing is in local or session storage, a forged camp cookie is ignored, and tampered or garbage session cookies lead to sign-in.
The page also ships a strict Content-Security-Policy (a fresh nonce per request, no inline scripts without it, no framing).
