# apps/server

The `@buxa/server` package: the server logic for the camp app. It holds the composers that the web app calls, the services that run each use case, the Postgres repositories, authentication and sessions, the HTTP helpers for route handlers, and the audit log writer. It runs only on the server.

## What it may import

The rules are in `test/architecture/packages.test.ts`. `apps/server` may import from `server`, `shared`, `domain`, `contracts` and `db`. It must not import from `web` or `middleware`. The runtime modules import `server-only`, so a client bundle that reaches them fails at build time.

## Folders

- `composers/`: entry points the web app calls (`index.server.ts` re-exports them). The attendance composers check their input with a `contracts` schema, find the signed-in actor, and call one service. For example, `composers/attendance/checkIn.ts` passes `CheckInInputSchema` to `runAttendanceAction` in `runAction.ts`.
- `services/`: the use cases, built with `create*Service` functions that receive their repositories and clock. For example, `services/attendance/createAttendanceService.ts` contains `checkIn`.
- `runtime.ts`: `getRuntime()` builds the repositories and services once, and `createRuntime()` wires them. Tests can install a runtime of their own.
- `repositories.ts`: connects each feature's Postgres repository to its interface.
- Feature folders `attendance/`, `classes/`, `people/`, `memberships/`, `credentials/`, `orgs/` and `users/`: the repository interfaces (`*Repository.ts`) and the Postgres implementations (`Pg*Repository.ts`). `attendance/` also has an in-memory repository.
- `auth/`: `authenticate.ts` and `authorize.ts` (`assertAllowed`), the token verifier, and email confirmation.
- `session/`: session cookies, refresh (`refresh.ts`, used by `proxy.ts` in the web app), and the Supabase and Next.js clients.
- `http/`: helpers for route handlers. `route.ts` has `authedRoute`, `errors.ts` the `HttpError` type and error body, `parse.ts` the body size limit, and `requestId.ts` the request id.
- `audit/recordAudit.ts`: the one place that writes `audit_log` rows.
- `rateLimit/`: the Postgres rate limiter.
- `agents/`: the agent server entry point (`npm run server` runs `agents/index.ts`).
- `config.ts`, `log.ts`: configuration from the environment, and the logger.
- `unimplemented.ts`: a placeholder for ports that have no adapter yet. Import storage has one.

## Entry points

- `src/index.ts`: re-exports `composers/index.server.ts`. Import by subpath, for example `@buxa/server/composers/index.server`.
- `composers/index.server.ts`: the list of composers the web app uses.
- `runtime.ts`: `getRuntime()`.
- `http/route.ts`: `authedRoute` and the route helpers.
- `agents/index.ts`: the agent server.

The check-in path is shown in the diagrams below. The web app calls `checkInAction` through a server action. The service decides, then the repository's `insertCheckIn` (in `attendance/PgCheckInWrites.ts`) writes the `check_ins` row and its audit rows.

## Tests

From the repository root:

- `npm test` runs every test.
- `npm run test:unit` skips the database tests.
- `npm run test:db` runs the database tests: the `pg.test` files, `limiter.test.ts`, `PgOrgRepository` tests, and the integration tests. They need `DATABASE_URL` set, for example `postgres://buxa:buxa@localhost:5433/buxa`.

Tests sit beside the code and in `__tests__/` folders.

## Diagrams

- [Folders and import direction](docs/diagrams/server-structure.html)
- [A check-in, from the action to the database and audit log](docs/diagrams/server-checkin.html)
