# Buxa web app

The Next.js app for camps: sign-in, the camp area (people, check-in, on site, attendance, classes), and the staff board.

## Flow diagrams

The flow diagrams (check-in, membership lifecycle, check-out with pickup, pickup authorisation) live in `docs/architecture/`. They are described and linked from the [Flows section of the root README](../../README.md#flows).

## Commands

- `npm run dev` runs the app on port 5173 from the repository root.
- `npm test` runs the test suite. Tests that need Postgres run only when `DATABASE_URL` is set.
- `npm run build` builds the production app.
