# Phase 8: payments and go-live

Status: **spec for review. No code yet.** Roadmap row: "Payments & go-live: Stripe Connect payments, refunds, and every security item needed for real children's data."
Depends on: every earlier phase. Until this phase is done, the app runs on demo and mock data only (see the real data rule in `docs/ROADMAP.md`).

## Part A: payments

### Words we use
- **Payment**: a charge taken by Stripe for a registration. Buxa never holds money; funds go to the camp's own Stripe account through Stripe Connect.
- **Refund**: money returned to the family for a cancelled registration, following the camp's refund rule.
- **Refund rule**: the camp's written rule (full, partial or none, by date).

### Decisions
1. **Stripe Connect only.** Each camp connects its own Stripe account. Buxa stores Stripe identifiers and payment status, never card numbers.
2. **Confirmation by webhook.** A registration is paid only when Stripe confirms it, not on the browser's word. Each webhook event is processed once (stored idempotency key).
3. **Refunds follow the camp's rule.** Staff can override with a reason, recorded in the audit log.
4. **Reconciliation.** Confirmed registrations are compared with Stripe's records on a schedule.

### Acceptance criteria
- A camp connects its Stripe account and sees its status.
- A family pays for a held registration and receives a confirmation; the hold becomes a paid place.
- A refund issued through the app is recorded and matches Stripe.
- Every payment, refund and price change is in the audit log.

### Exit tests
- Webhook: the same event delivered twice is processed once.
- Webhook: a forged or unsigned webhook is refused.
- Reconciliation: a test compares confirmed registrations with Stripe test-mode payments and reports any mismatch.
- Privacy: payment identifiers are never returned to viewers; card data never reaches Buxa's logs.

## Part B: go-live for real children's data

This part is the gate. Real data is stored only after every item below is done. Each item links to `docs/security.md`.

### Items
- [ ] Privacy review of children's data (COPPA, state rules), with consent and notice text signed off.
- [ ] Retention periods and a deletion process for each record type.
- [ ] Access logging for people, attendance and portal records.
- [ ] Rate limits on API and scanner endpoints.
- [ ] Two-factor sign-in for staff and admins.
- [ ] Automated backups with a tested restore.
- [ ] Separate production Supabase project and Vercel environment; previews never connect to it.
- [ ] Error and security monitoring with alerts.
- [ ] Every finding of the 2026 audit (`docs/audit/2026-security-and-code-audit.md`) marked fixed or accepted with a reason.
- [ ] Secrets review: no keys in the repository or build logs; a rotation plan.
- [ ] External penetration test, with findings fixed.

### Exit tests
- The penetration test report has no open critical or high findings.
- A restore from backup is performed into a new database and verified against a known camp.
- The access log records every read of a child's record in a test camp.

## Not in this phase
Multi-currency, instalment plans, school invoices, medical records, photos.

## Open for review
- Whether payments go live before the parent portal (phase 6) or after it.
- Which camp (pilot) goes live first, and what its data is.
