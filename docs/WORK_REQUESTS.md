# Owner's work requests

A plain-words summary of the change requests the owner has made for the Buxa camp app, how urgent each one is, where it stands, and which issues and PRs track it.

## How to read this

- Requests are grouped by impact, most urgent first.
- **Status** is one of Done, In progress or Planned.
- **Tracked in** lists the board issue first, then the PR that delivered it. `#n` is an issue or PR on GitHub.
- "Not tracked yet" means no issue or PR links the request. An issue has been opened for it, so it can be tracked.

## Impact

| Level    | Meaning                    |
| -------- | -------------------------- |
| Critical | Blocks production or users |
| High     | Core product or quality    |
| Medium   | Improves a flow            |
| Low      | Polish                     |

## Critical (4)

| Request                                                             | Status                 | Tracked in                     |
| ------------------------------------------------------------------- | ---------------------- | ------------------------------ |
| Production Supabase certificate fix, so the production build passes | Done                   | #106, PR #216, release PR #217 |
| Owner decision: production build migrations and mock data           | Planned                | #110                           |
| Owner check: phone check-in timing on iPhone and Android            | Planned, after phase 4 | #98 (evidence PRs #186, #193)  |
| Owner check: signed-in walkthrough on the production build          | Planned, after phase 4 | #100                           |

## High (11)

| Request                                                                        | Status      | Tracked in                             |
| ------------------------------------------------------------------------------ | ----------- | -------------------------------------- |
| Camp archive and delete, with two warnings; archived camps can still be viewed | Planned     | #247                                   |
| Owner sees and can do everything in the kanban                                 | Done        | Not tracked yet (#252)                 |
| Home dashboard like the reference: stat cards, charts, next sessions           | Done        | #236, PR #219                          |
| Dark theme with a coral accent                                                 | Done        | #229, PR #211                          |
| Light and dark sign-in backgrounds                                             | Done        | Not tracked yet (#253)                 |
| Button redesign with HeroUI and Tailwind, thinner headers, round icon buttons  | In progress | #243                                   |
| Code clean-up: braces, spacing, lint rules, comments, types instead of `any`   | Done        | #239, PR #222 (comments partly done)   |
| Docs review: app READMEs with diagrams                                         | Done        | #239, PR #222                          |
| PNG previews for the diagrams in the READMEs                                   | Planned     | #245                                   |
| CI: umbrella Verify build job, scoped CI, deploys only after verify            | Done        | #107, #228, #231, #232, PRs #213, #215 |
| Recurring events, public class pages and iCal feed (phase 2)                   | Planned     | #248                                   |

## Medium (15)

| Request                                                                                                             | Status      | Tracked in                                            |
| ------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| Phase 1 closed                                                                                                      | Done        | #198, PR #87                                          |
| Owner checks moved to phase 2                                                                                       | Superseded  | #223, PR #97. Now after phase 4 (owner-acceptance.md) |
| Mobile app moved to phase 6                                                                                         | Done        | #238, PR #221                                         |
| Permission categories in phase 3                                                                                    | Done        | Not tracked yet (#254)                                |
| Clock format: 12 or 24 hour (server messages still to follow)                                                       | In progress | #205, PR #94, #105                                    |
| Stacked check-in chart with Parent/Guardians and Students                                                           | Done        | Not tracked yet (#255)                                |
| New class as a popup                                                                                                | Done        | #236, PR #219                                         |
| Add person as a popup with a tidy form                                                                              | Done        | #207, PR #96                                          |
| Settings as a responsive grid, and Settings, Help and Reports in the profile menu, with the name in the menu header | Done        | PR #96, #235, PR #218                                 |
| Remove `any` and `unknown` with a `types.ts` per folder                                                             | Done        | Not tracked yet (#256)                                |
| Release v0.1.3 tag and v0.2.2 release                                                                               | Done        | #226, PR #208, #234, PR #217                          |
| Every PR linked to a board issue, and out-of-phase work tracked                                                     | Done        | PR #250 (issue #249 is still open)                    |
| Lint: remove unneeded `async` and non-null assertions                                                               | In progress | #244                                                  |
| Lint: the remaining warnings                                                                                        | Planned     | #246                                                  |
| Bulk import has a database adapter (phase 2 check)                                                                  | Planned     | #102                                                  |

## Low (4)

| Request                                                                                     | Status | Tracked in             |
| ------------------------------------------------------------------------------------------- | ------ | ---------------------- |
| Lucide icons                                                                                | Done   | #239, PR #222          |
| Role pill colours: owner purple, admin orange, staff green, viewer blue, teacher green-blue | Done   | Not tracked yet (#258) |
| Projects add and remove (kept)                                                              | Done   | Not tracked yet (#257) |
| Login background as in the reference                                                        | Done   | Not tracked yet (#253) |

## Decisions you made

- Camp archive keeps data hidden; delete removes everything.
- The owner sees everything in the kanban.
- Labels are "Students" and "Parent/Guardians".
- Phase 1 is closed.
- The mobile app is in phase 6.
- The 36px button height is below the 44px touch target. To check.
