# Phase 3: registration

Status: **spec for review. No code yet.** Roadmap row: "Registration: sign-up forms with custom fields, holds, waitlist. No card payments yet (demo only)." Card payments and refunds moved to phase 8 (`08-payments-go-live.md`).
Depends on: phase 2 (sessions and enrolments).

## Words we use

- **Registration**: a family's request to enrol a camper in one or more sessions, with the form answers and a payment.
- **Registration form**: a camp's form for a season, with standard fields (camper, guardian, emergency contact) and custom fields the camp defines. Custom fields are typed (text, choice, date, yes/no) and validated by schema.
- **Hold**: a short reservation of a session place while a family completes payment. A hold expires after a set time (proposed: 15 minutes) and returns the place.
- **Waitlist**: an ordered queue for a full session. A place released by a cancellation goes to the first waitlisted registration.
- **Price**: an amount shown for a session, with an optional early-bird date. Shown for information only in this phase; nothing is charged.

## Decisions

1. **No money in this phase.** Registrations are demo-only and no card is charged. Payments follow in phase 8.
2. **Holds, not overselling.** Taking a place is done in a database transaction that locks the session row. A hold expires on its own; a background job releases expired holds.
3. **Confirmation** is a staff action in this phase, recorded in the audit log, until payments arrive in phase 8.
4. **Custom fields are versioned.** A change to a form does not change answers already given; each answer stores the form version.
5. **Prices are stored in the smallest currency unit** with the currency code, for display only.

## Acceptance criteria

- A camp admin can create a registration form for a season, add custom fields, and publish it.
- A family can register a camper for one or more sessions and see a confirmation (no payment in this phase).
- A full session takes a waitlist entry; when a place frees, the first waitlisted registration is offered it.
- An unpaid hold returns its place after the expiry time.
- Every registration, confirmation and price change is in the audit log.

## Exit tests (must pass in CI before the phase is done)

- Concurrency: two registrations for the last place, in parallel, produce exactly one confirmed registration and one waitlist entry.
- Concurrency: a hold and a new registration racing for the same place never both succeed.
- Privacy: registration answers are never returned to viewers beyond their role.

## Not in this phase

Card payments, refunds, Stripe Connect, instalments, sponsorship funds (all phase 9). Multi-currency.

## Open for review

- Hold length (proposed 15 minutes) and whether camps can change it.
- Whether a deposit or balance-later option is wanted once payments arrive (phase 8).
