# Phase 6: communications, parent and instructor portals, waivers and reports

Status: **spec for review. No code yet.** Roadmap row: "Comms & extras: reminders, waivers, parent portal, reports."
Depends on: phases 3 and 4. The parent portal is the largest part and needs the privacy review before real data (see `docs/security.md`).

## Words we use

- **Reminder**: a message sent to a family or staff member at a set time before a session (for example, 7 days before, what to bring).
- **Waiver**: a signed document a guardian must accept before a camper attends. Stored with the signed time, the document version and the signer's identity.
- **Parent portal**: a signed-in area where a guardian sees their own campers' sessions, memberships, check-in history (day and time only), balances and waivers, and updates their contact details.
- **Instructor portal**: a signed-in area where an instructor sees their own sessions, the roster for each session (names and ages only) and can record their own attendance.
- **Report**: a fixed view of camp data for staff, such as enrolment by session, attendance by day, or capacity by class. Reports are read-only and respect each role's permissions.

## Decisions

1. **Guardians see only their own children.** A guardian's access comes from a household link (phase 1), checked on every request. No parent can see another family's data, and no URL takes a person id without that check.
2. **Instructors see names and ages of their own roster only**, never contact details or medical notes.
3. **Waivers are versioned and immutable.** Changing a waiver creates a new version; signatures keep the version they were given on.
4. **Reminders are idempotent**: each reminder is sent once per recipient per session, even if the job runs twice.
5. **Messages are sent through a provider** (email first; SMS later). The app stores only the provider's message id and status, not message bodies sent to children's records.
6. **Reports are generated from the same permission checks** as the screens they summarise.

## Acceptance criteria

- Staff can send a reminder to all families in a session, with a preview and a schedule.
- A guardian can sign in, see only their own children, accept a waiver, and update their contact details.
- An instructor can sign in and see only their own sessions and rosters.
- Staff can run the listed reports for a date range and export them as CSV.
- A waiver signature stores the version, the time and the signer; it cannot be altered afterwards.

## Exit tests (must pass in CI before the phase is done)

- Access: a guardian cannot read another family's child by changing an id in the URL, the API or a server action (tests for each).
- Access: an instructor cannot read a contact detail or a medical note (tests for each).
- Waivers: an edit to a waiver version is refused; a new version does not alter earlier signatures.
- Reminders: the same reminder job run twice sends each message once.
- Reports: each report's totals match the database for a seeded test camp.
- Security: the parent and instructor portals pass the security review checklist in `docs/security.md` before launch.

## Not in this phase

Two-way messaging, SMS, mobile push notifications, payments from the portal (phase 3 handles payment), photo sharing.

## Open for review

- Whether the parent portal is needed earlier, after phase 3, because families will ask for it when they pay.
- Which reports camps need on day one.
- Whether waivers are a fixed template per camp or can be uploaded as a PDF.
