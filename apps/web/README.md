# Buxa web app

The Next.js app for camps: sign-in, the camp area (people, check-in, on site, attendance, classes), and the staff board.

## Public flow diagrams

Public diagrams live in `public/flows/` and are served at `/flows/<file>`. They describe how the app works, with no data. Each diagram is made with archify and is updated in the PR of every release (see `CONTRIBUTING.md`).

| Diagram | Source in the repo | Open on the site |
|---|---|---|
| Check-in | [public/flows/checkin-flow.html](public/flows/checkin-flow.html) | [/flows/checkin-flow.html](/flows/checkin-flow.html) |
| Membership lifecycle | [public/flows/membership-lifecycle.html](public/flows/membership-lifecycle.html) | [/flows/membership-lifecycle.html](/flows/membership-lifecycle.html) |
| Check-out with pickup | [public/flows/checkout-sequence.html](public/flows/checkout-sequence.html) | [/flows/checkout-sequence.html](/flows/checkout-sequence.html) |

GitHub shows the source of each diagram; the site serves the rendered page at the second link. Each row covers: check-in (scan or search, membership check, override, recording the visit), membership status (none, valid, expired, revoked), and check-out with pickup (who may collect a child, and the audit entry).

If a diagram here disagrees with the code, the code wins. Open an issue or fix the diagram in the same PR as the change.

## Commands

- `npm run dev` runs the app on port 5173 from the repository root.
- `npm test` runs the test suite. Tests that need Postgres run only when `DATABASE_URL` is set.
- `npm run build` builds the production app.
