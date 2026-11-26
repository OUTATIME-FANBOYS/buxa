# Buxa roadmap: camp management

Buxa is a camp and membership platform. The kanban board stays as the **staff operations module**
(prep and day-of tasks). Agent approvals inside the camp flows are phase 7, after the camp core works.

Build order follows the product roadmap: **members & check-in → events & calendar → registration → seats & rosters →
scheduling → comms & extras → licensing & plans → payments & go-live.** Payments come last because they need every earlier phase.

## How every phase works

1. **Spec first.** Write the phase's glossary terms and acceptance criteria in `docs/phases/NN-name.md` before code.
2. **Tests before behaviour** for domain rules (tdd). A phase is not started until its exit tests are listed.
3. **Small PRs**, each passing CI. Feature and fix PRs are squash-merged into their phase branch; the phase branch merges into `develop` with a merge commit. Conventional commit titles (`feat:`, `fix:`, `docs:`, `chore:`). The full rules are in `docs/CONTRIBUTING.md`.
4. **Exit gate.** A phase is done only when its exit criteria pass in CI _and_ a person has used it end to end.
5. **Tag each release** on `main` (`vX.Y.Z`) so progress is visible on GitHub.

## Phases

| #   | Phase                                                                                  | Deliverable                                                                                                                                     | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Foundation                                                                             | Monorepo, Postgres, migrations, managed auth, orgs (tenants), roles, audit log, CI                                                              | Two orgs cannot see each other's rows (tested); CI green; deploy to a staging URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1   | Members & check-in (spec: `docs/phases/01-members-checkin.md`)                         | People & households, memberships (valid/expired), QR + name lookup, attendance log                                                              | Staff check in a member in under 5 seconds on a phone (iOS Safari and Android Chrome); attendance export; staff can install the app and sign in from a phone. **Status:** released as v0.1.0 without the installable app. The app was reverted for v0.1.1 and re-landed on `develop` in #82; it is built. Phase 1 is closed in the code. The three owner checks (phone timing, install and sign-in from a phone, and the signed-in walkthrough) moved to phase 2: see "Carried over from phase 1" in `docs/phases/02-events-calendar.md`                                                                                                                                                                                                   |
| 2   | Events & calendar (spec for classes and sessions: `docs/phases/02-events-calendar.md`) | Sessions (date ranges) that hold classes (time ranges), camp size, enrolment. Recurring events, public pages and the iCal feed moved to phase 3 | Recurrence rules tested incl. DST; public page works without login. **Status:** built: sessions with date ranges, classes with time ranges, editing and deleting classes, enrolment (age range, overlap with an audited admin override, camp size and waitlist), bulk CSV import with a preview before save, and the sessions screens at `/camp/sessions`. Exit-test gaps for the domain and service rules are closed by tests. Still open: the owner's signed-in check at 390px and 1280px (carried over; see phase 02). Recurring series, public session pages and the calendar feed moved to phase 3 and are built on the phase 3 branch (not yet merged)                                                                               |
| 3   | Registration (spec: `docs/phases/03-registration.md`)                                  | Sign-up forms with custom fields, confirmation. No money in this phase. Holds and waitlist moved to phase 4                                     | Concurrent sign-ups never exceed capacity; an expired hold returns its place. **Status:** in progress. Built: sign-up forms with custom fields and versions, registrations by session, confirmation (a separate staff step), session prices, seat-hold rules, the teacher role, calendar links and public session pages. Holds taken from registration and the waitlist moved to phase 4; price display to phase 6; payments and refunds to phase 9. Also on the branch: notifications (0037), teacher invites by email (0038), Manage access for role changes (0039), owner-only person delete (0040), a paged People list and one person form. Not built: invites for roles other than teacher, removing a member, and membership expiry |
| 4   | Seats & rosters                                                                        | Groups, cabins, rooms, assign people, per-session check-in, seat holds and waitlist (moved from phase 3)                                        | Ratio rules enforced; assignments conflict-checked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | Scheduling                                                                             | Conflict detection first, auto-schedule later                                                                                                   | Conflicts for staff, rooms and gear reported with zero false negatives in tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6   | Comms & extras                                                                         | Reminders, waivers, parent portal, reports, registration price display (moved from phase 3)                                                     | Waiver stored with timestamp and version; reminders idempotent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ops | Staff board (existing kanban)                                                          | Move onto the new backend, scoped per org. Help and Reports moved out of the sidebar into the account menu.                                     | Existing 60 tests ported or replaced. **Status:** the calendar view gives each task chip a priority border, shows five tasks a day with a "+N" pill for the rest, and has month and year navigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8   | Licensing & plans (spec: `docs/phases/08-licensing-plans.md`)                          | Plans per camp, feature entitlements enforced on the server, trials, manual plan assignment                                                     | Every feature with an entitlement is refused without it, on every route and action (tested). **Status:** spec only, no code yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9   | Payments & go-live (spec: `docs/phases/09-payments-go-live.md`)                        | Stripe Connect payments and refunds, and every item needed before real children's data                                                          | Webhooks processed once; the go-live checklist in the spec is done. **Status:** spec only, no Stripe code yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Staff mobile app (phase 6)

The installable staff app (a PWA built into the existing site, not a native app) moves to **phase 6**, with the
parent portal. It starts once the web app runs properly on the production build. Reason: the web app has to work for
staff and admins first, and the phone app reuses the same screens. The decision still holds: one codebase, no
app-store review, and a native app is revisited only if the PWA cannot meet the 5-second check-in target on real phones.
Mobile check-in needs a connection; offline check-in stays out of scope (see `docs/phases/06-comms-extras.md`).

**Status:** the manifest and the install hint were built in #82 and are on `develop`, but they are not part of phase 1's
exit. The owner's checks for them (phone timing, install and sign-in from a phone) run after phase 4, in `docs/phases/owner-acceptance.md`.

## Decisions that must be made early (from the roadmap)

- Multi-tenant from day one: `org_id` on every row, Postgres row-level security.
- Generic events with custom fields per org (typed JSON validated by schema).
- Never hold money: Stripe Connect only.
- Kids' data: consent, medical notes, minimal retention, encryption at rest, access logging. US privacy rules for minors (COPPA, state laws) to be reviewed before real data.
- No overselling: expiring seat holds and database transactions, covered by a concurrency test.
- Camp licensing rules: ratios, background checks, pickup authorization are modelled, not free text.
- WCAG 2.2 AA from the start.
- Talk to 5 to 10 camp directors before phase 2. Your own org is customer zero.

## Not doing yet

Auto-scheduling, SSO, native apps, non-US payments. Agent approvals inside the camp flows are now phase 7 (see `docs/phases/07-staff-board.md`, "AI assistant").

## Future: on-the-spot registration with payment (phase 9)

A camp can register someone at the desk, on the day, and take payment there. It builds on the membership link to sessions (migration 0042), so the registration creates a membership for the chosen session, and the payment step is added in phase 9 with Stripe. Not started; recorded so the membership and payment work stays aligned.

## Phase 8: camp subdomains and custom domains

Each camp gets its own address, such as `camp-birchwood.buxa.app`, through a wildcard domain on Vercel. The camp's existing unique slug is the subdomain; reserved names (`www`, `app`, `api`, `admin`) are blocked. Sign-in and invite links use the camp's address, and the Supabase Site URL and redirect list cover the wildcard.

Custom domains (for example `register.birchwood.org`) are a plan feature, verified and attached automatically. Decide before building: whether one sign-in works across camps, and whether every camp gets a subdomain or only paid plans.

## Phase 6: parent portal (decided)

A parent or guardian gets a login through a family invite, linked to their person record. Their household is the only data they can see.

- **Their own profile:** name, phone, email and address. Billing details come with phase 9.
- **Their children:** the parent acts like an admin for each child. They can view and update the child's details, including medical and emergency details.
- **Badges:** they see each child's badge with the same show and reissue rules as staff.
- **Session memberships:** they see what has been bought and what is still to come. Staff record purchases until online payment exists.
- **Invoices and receipts:** phase 9, with payments.

A family role gets its own access rules and row-level security, so one family cannot see another.

## Later: profile pictures

Until this phase, every person shows a blank template picture (`PersonAvatar`, apps/web/components/elements/PersonAvatar.tsx). The real feature, agreed for a later phase:

- **Storage:** Postgres, like registration files, resized to about 256 pixels on upload.
- **Who can upload:** staff, and the family's guardian for their children. Staff-only is the default for children.
- **Where it shows:** the People list and the person page. Children's pictures stay off the on-site and check-in screens by default.
- **Fallback:** the blank template when no picture is set.
