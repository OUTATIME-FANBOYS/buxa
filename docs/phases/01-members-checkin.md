# Phase 1: people, memberships and check-in

Status: **spec for review. No code yet.** Roadmap row: "Members & check-in: QR scan + name lookup, valid / expired, attendance log."
Decided with the owner: members are **children with parents or guardians, adults who take part, organisers, instructors and admin people**; a membership is **a date range** (a season or a year); a check-in records **who, when, which staff member, and check-out too**.

## Goal and exit criteria
A staff member can find a person, see at a glance whether they may attend today, and check them in and out, fast and correctly.
- Check-in takes **under 5 seconds on a phone**, by QR scan or by typing a name.
- Valid, expired, not yet started and revoked are unmistakable (colour **and** words, WCAG AA).
- A child cannot be checked out to someone who is not an authorised guardian, unless an admin overrides it with a reason (audited).
- Staff can see who is on site right now, and export the attendance log as CSV.
- Nothing crosses organisations: every new table has forced row-level security, proven by the existing catalog test plus per-table isolation tests.
- All of it works with a handheld scanner (it types the code and presses Enter) and with the phone camera.

## Vocabulary (one meaning each, used in code, UI and docs)
- **Person**: anyone the camp keeps a record of.
- **Camp role** (what someone *is* at camp): `camper` (child), `participant` (adult taking part), `guardian`, `instructor`, `organizer`, `admin_staff`. A person can hold several (a guardian who is also an instructor).
  *Not the same as the permission roles* (`viewer`, `staff`, `admin`, `owner`), which decide what a **signed-in user** may do. Linking a person to a user account is not in this phase.
- **Household**: the people who belong together. It carries the guardian relationships.
- **Guardian link**: a guardian ↔ a camper in a household, with `can_pickup` (may collect the child).
- **Membership**: a person's right to attend for a date range, with a plan label (for example "Summer 2027"). Its **status** is computed, never stored: *not yet started*, *valid*, *expired* or *revoked*.
- **Credential** (badge): the QR code that identifies a person at the door. An opaque random token, hashed at rest, revocable. It contains no personal data.
- **Check-in**: one arrival, with an optional departure. **On site** means checked in and not yet checked out.

## Data model
Every table has `org_id`, forced row-level security, and a policy scoped to the current organisation (the catalog test fails on a new table without them). Request handling reads and writes them as `buxa_app` through `withOrg`.
| Table | Holds |
|---|---|
| `people` | `given_name`, `family_name`, `preferred_name?`, `date_of_birth?`, `email?`, `phone?`, `archived_at?` |
| `person_roles` | (`person_id`, `role`) |
| `households`, `household_members` | household name; (`household_id`, `person_id`, `relationship`, `is_guardian`, `can_pickup`) |
| `memberships` | `person_id`, `plan`, `starts_on`, `ends_on` (dates), `revoked_at?`, `revoked_reason?`; `ends_on >= starts_on` |
| `credentials` | `person_id`, `token_hash`, `issued_at`, `issued_by`, `revoked_at?`; at most one active per person |
| `check_ins` | `person_id`, `checked_in_at`, `checked_in_by`, `method` (`qr`, `search`, `manual`), `checked_out_at?`, `checked_out_by?`, `collected_by_person_id?`, `override_reason?`, `note?`; **at most one open row per person** (partial unique index) |
| `orgs` (change) | add `timezone` (IANA name, default set at creation) so "today" and "valid" mean the camp's local day |

**Deliberately not stored in this phase:** medical or allergy notes, photos, home address, government ids. Minimising children's data is the safest design, and storing health data needs the privacy and compliance review first (`docs/deploy.md`). Date of birth is kept only to tell whether someone is a minor.

## Rules (pure functions in `@buxa/domain`, tested as tables)
1. **Membership status** for a day in the camp's time zone: `revoked` if `revoked_at` is set; else `not_started` before `starts_on`; `valid` from `starts_on` through `ends_on` inclusive; `expired` after. A person with several memberships is **valid if any is valid**; otherwise the most relevant one is shown.
2. **Check-in** is allowed only when the person is valid. Otherwise it is refused with the reason. An **admin** may override with a written reason (recorded on the row and in the audit log). A person already on site gets "already checked in at 09:12", never a second row.
3. **Check-out** of a camper (child) requires choosing a guardian with `can_pickup`; an admin may override with a reason. Adults check out freely. Check-out of someone not on site is refused.
4. **Minor** = under 18 on the camp's local date (or a `camper` with no date of birth is treated as a minor: safe by default).
5. **Credential resolve**: an unknown or revoked token answers one neutral "not recognised" with no hint whether it ever existed. Tokens are 128 bits from a CSPRNG, shown once at issue, stored only as a SHA-256 hash, compared in constant time. Reissuing revokes the old badge.
6. **Name search**: case- and accent-insensitive, matches given, family or preferred name, hides archived people, returns at most 20.
7. Every create, update, archive, membership change, credential issue or revoke, check-in, check-out and override writes an **audit entry** (the `AuditAction` union grows; adding an action is the compiler's cue to handle it).

## Permissions
Existing actions are reused; new ones are added to the matrix test (role × action).
| Capability | viewer | staff | admin | owner |
|---|---|---|---|---|
| See people, memberships, attendance (`people:read`, `attendance:read`) | names, roles, status only | yes | yes | yes |
| Add and edit people, households (`people:create/update`) | no | yes | yes | yes |
| Check in and out (`attendance:record`) | no | yes | yes | yes |
| Manage memberships, issue or revoke badges (`memberships:manage`, `credentials:manage`) | no | no | yes | yes |
| Override a refused check-in or check-out (`attendance:override`) | no | no | yes | yes |
| Archive a person (`people:delete`), export attendance (`attendance:export`) | no | no | yes | yes |
Date of birth, email and phone are visible to staff and above, not to viewers. The server decides what each role receives; the UI only mirrors it.

## Screens and routes (all in `config/routes.ts`)
`/camp/people` (list and search, add) · `/camp/people/new` · `/camp/people/[id]` (roles, household, membership with a status pill, badge to print, attendance history) · `/camp/check-in` (the fast screen) · `/camp/on-site` (who is here now, check-out) · `/camp/attendance` (log, filters, CSV export).
**Check-in screen:** one focused input that accepts a scanner or typing; large result cards with status in colour and words; a single primary action; a camera button; clear feedback. A person is never shown without their status.
The UI reads in Server Components and writes through Server Actions, all through the same services. No `/v1` endpoints for these in this phase (the public API comes later); the shapes still live in `@buxa/contracts`.

## Test plan (written before the code)
- **Domain:** status table (boundaries: day before, first day, last day, day after; revoked; leap day; time-zone midnight), minor rule, check-out rule, multiple memberships.
- **Schema:** every new table passes the catalog test (forced RLS + policy); per-table tenant isolation (org A cannot read or write org B); one open check-in per person; one active credential per person; `ends_on >= starts_on`.
- **Repositories:** one contract test suite run against Postgres **and** an in-memory adapter.
- **Services:** every rule above, with permission checks per role; audit entries; no double check-in; override needs a reason; guardians must have `can_pickup`.
- **Credentials:** token length and randomness, hash at rest, constant-time compare, revoked and unknown tokens give the identical answer, reissue revokes.
- **Search:** diacritics, case, archived hidden, limit.
- **Actions and screens:** action tests with mocked session; accessibility checks on the new screens; real-browser flow with a real sign-in: add a person → membership → badge → scan → check in → on site → check out → export.

## Chunks (built in parallel, as for steps 3 and 4)
**Wave 0 (one person, first, so the rest can start together):** migration `0007` (tables, indexes, policies, grants, `orgs.timezone`), the pure rules and types in `@buxa/domain`, the contract schemas, the new permission actions and the updated matrix test, the route constants, and **frozen repository and service interfaces** with stubs.
| Chunk | Owns | Delivers |
|---|---|---|
| **P1 Data** | `server/people/**`, `server/attendance/**` repositories, `packages/db` tests | Postgres and in-memory adapters; contract suite; isolation and constraint tests |
| **P2 Services** | `server/services/{people,memberships,credentials,attendance}.ts` | The rules, permissions and audit; tested against the in-memory adapter |
| **P3 People screens** | `features/people/**`, `app/(app)/camp/people/**` | List, search, add, detail, household, membership, actions |
| **P4 Check-in screens** | `features/attendance/**`, `app/(app)/camp/{check-in,on-site,attendance}/**` | The fast check-in screen, on-site list, log and CSV export |
| **P5 Badge and scanner** | `lib/qr/**`, `features/attendance/scanner/**` | Token issue and hash, QR rendering and printable badge, scanner-input hook, camera scanner component |
| **P6 Mock data and e2e** | `scripts/seed-mock.ts`, test fixtures | Realistic mock camp (families, staff, seasons) and the browser flow |
Contracts between chunks are frozen in Wave 0, ownership is exclusive, each chunk opens a PR into an integration branch, and one PR goes to `develop` after the full browser flow passes on the production build.

## Decisions to confirm (my defaults in bold)
1. Check-in needs a **valid** membership; only admins override, with a reason. Alternative: staff may override.
2. Camp time zone is set when the camp is created (from the creator's browser) and **editable by admins**.
3. **No medical or allergy data, photos or addresses** until the privacy review.
4. Viewers see **names, roles and status only**.
5. **Household is optional** for adults; **required** for campers (at least one guardian).
6. Several memberships may overlap; the person is valid if **any** is valid.
7. A kiosk where adults check themselves in is **not** in this phase.
8. Offline check-in (no signal at the door) is **not** in this phase; it is on the list for later.

## Done when
Every exit criterion above passes in CI and in a real browser on the production build, a person has used it end to end, and the mock data scripts reset cleanly. Tag `v0.2.0`.
