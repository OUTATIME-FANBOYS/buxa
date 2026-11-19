# apps/web

The Buxa web app: a Next.js 16 app (App Router) that serves the pages, the `/v1` route handlers and the server actions the browser calls. It is the only app that renders HTML. The business rules live in `packages/domain` and `apps/server`, not here.

## What it may import

The rules are in `test/architecture/packages.test.ts`. `apps/web` may import from `web`, `middleware`, `shared`, `server`, `domain`, `contracts` and `db`, although production code uses only the first six (`db` appears only in integration tests).

Client code never reaches the server package. Any module marked `'use client'`, and everything it imports, must not reach `@buxa/server`. A `'use server'` file is the boundary: its body runs on the server, and the client only gets a reference to it. That is why `actions/` exists.

## Folders

- `app/`: routes. `(app)/camp/` holds the signed-in pages, grouped as `(admin)`, `(operations)` and `(work)`. `sign-in/`, `health/`, `ready/` and `maintenance/` are public. `v1/` holds the route handlers (`me`, `members`, `org`, `orgs`). `layout.tsx` is the root layout, which sets the per-request nonce.
- `actions/`: `'use server'` wrappers (`attendance.ts`, `auth.ts`, `camp.ts`, `classes.ts`, `people.ts`) that client components call. Each one forwards to a composer in `@buxa/server`.
- `components/views/`: server components (no `'use client'`). Each one loads data through `@buxa/server` composers and renders a screen, for example `CheckInScreen.tsx`.
- `components/components/`: UI components, mostly client code. `components/elements/` holds small reusable pieces.
- `config/`: brand, environment, routes, security headers and the content security policy, and theme.
- `styles/`: CSS (tokens, base, layout, features, components).
- `public/`: icons, and `theme-init.js`, which sets the theme before the first paint.
- `__tests__/integration/`: database-backed integration tests.
- `proxy.ts` (at the root of the app): runs before every page and API request. It sets a fresh CSP nonce and the security headers, and renews session cookies.

## Entry points

- `app/layout.tsx`: root layout.
- `proxy.ts`: request gate (nonce, headers, session refresh).
- `app/(app)/camp/(operations)/check-in/page.tsx`: an example screen. It renders `components/views/attendance/CheckInScreen`.
- `app/v1/*/route.ts`: JSON route handlers built with `authedRoute` from `@buxa/server/http/route`.
- `actions/*.ts`: the server actions client code calls.

## Tests

From the repository root:

- `npm test` runs every test, including the architecture and docs-link checks.
- `npm run test:unit` skips the database tests.
- `npm run test:db` runs the database tests (`apps/web/__tests__/integration` among them). They need `DATABASE_URL` set, for example `postgres://buxa:buxa@localhost:5433/buxa`.

Component and page tests sit beside the code (`*.test.ts`, `*.test.tsx`) and in `__tests__/` folders.

## Diagrams

Each preview links to the interactive diagram, which you can explore in the browser. The standalone HTML files are in `docs/diagrams/` if you want to download them.

### Folders and import direction

[![Folders and import direction, preview](docs/diagrams/web-structure.png)](https://htmlpreview.github.io/?https://github.com/OUTATIME-FANBOYS/buxa/blob/develop/apps/web/docs/diagrams/web-structure.html)

[Open the interactive diagram](https://htmlpreview.github.io/?https://github.com/OUTATIME-FANBOYS/buxa/blob/develop/apps/web/docs/diagrams/web-structure.html)

### A page request, browser to HTML and back

[![A page request, browser to HTML and back, preview](docs/diagrams/web-request.png)](https://htmlpreview.github.io/?https://github.com/OUTATIME-FANBOYS/buxa/blob/develop/apps/web/docs/diagrams/web-request.html)

[Open the interactive diagram](https://htmlpreview.github.io/?https://github.com/OUTATIME-FANBOYS/buxa/blob/develop/apps/web/docs/diagrams/web-request.html)
