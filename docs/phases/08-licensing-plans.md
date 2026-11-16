# Phase 8: licensing, plans and feature locks

Status: **spec for review. No code yet.** Roadmap row: "Licensing & plans: plans per camp, feature entitlements enforced on the server, trials, manual plan assignment. Charging comes in phase 9."
Depends on: phases 1 to 7 (the features it locks). Payments (phase 9) charge for the plans this phase defines.

## Words we use

- **Plan**: a named bundle of features and limits, for example Starter, Camp, Group. Plans are data, not code.
- **Entitlement**: one feature or limit a camp has under its plan, for example "classes", "parent portal", "up to 300 people".
- **Feature lock**: what a camp sees when an entitlement is missing: the feature is hidden or shown as "available on Camp plan", never silently broken.
- **Subscription status**: trial, active, past due, cancelled. A camp with a past-due or cancelled subscription keeps read access to its data for a set period and loses write access to locked features.
- **Licence**: the right to use Buxa, granted through a plan. Hosted camps hold a subscription; a self-hosted licence is out of scope for now.

## Decisions

1. **Hosted subscriptions, not licence keys.** Camps use Buxa on our servers under a plan. No keys are shipped to camps. A self-hosted licence (signed file checked offline) is a later option, not part of this phase.
2. **Server enforces every lock.** The UI hides a locked feature for clarity only. Each action and route checks the camp's entitlement as well as the user's permission, in the same place as `assertAllowed` (`packages/domain`).
3. **Plans are seeded data, versioned.** Changing a plan's features does not change a camp's signed-up plan without an admin action, recorded in the audit log.
4. **Trials** are a time-limited plan with all features, ending with a clear notice. A trial needs no card in this phase.
5. **Data is never held hostage.** A lapsed camp can always export its own data (CSV) and read its records; only writes to locked features stop.
6. **Manual assignment first.** In this phase Buxa's own staff assign plans. Self-service checkout arrives in phase 9 with Stripe.
7. **Feature locks are introduced from phase 2 onward.** Each new feature in phases 2 to 7 declares its entitlement key; phase 8 adds the plan table, the enforcement, and the screens for it.

## Acceptance criteria

- Buxa staff can create plans and assign a plan and status to a camp, with the change in the audit log.
- A camp without the "classes" entitlement cannot open class or session pages and the API refuses class writes, with a message naming the plan that unlocks it.
- A trial shows its end date and what it includes; after it ends the camp moves to the free read-only tier.
- A lapsed camp can still read and export its own records.
- The camp's own admins can see their plan, limits and usage, and can ask to upgrade (the request is recorded).
- A limit (for example number of people) blocks adding the person past the limit, with a clear message.

## Exit tests (must pass in CI before the phase is done)

- Every feature with an entitlement key is refused without it on every route and action (a test generated from the feature list, so a new feature cannot skip it).
- A locked feature's UI state matches the server's answer (shared function, tested).
- Limits: the boundary is allowed (exactly at the limit) and one over is refused.
- Read access: a lapsed camp can read and export; it cannot write locked features.
- Audit: every plan change and every trial change is recorded with who made it.
- Tenant isolation: one camp's plan and usage are not visible to another camp.

## Licence for the code (decision needed)

The repository is public on GitHub and has **no LICENSE file**. Without one, the code is all rights reserved by default: others may read it but may not use or copy it. Decide before any release that is shared outside the team:
- proprietary (all rights reserved, recommended while the product is commercial), or
- an open-source licence (for example MIT or AGPL) if the code should be reusable.

This is a business decision for the owner, not an engineering one. The LICENSE file and any third-party notices follow that decision.

## Not in this phase

Card payments and invoices (phase 9), usage-based billing, self-hosted licence keys, reseller and white-label plans, tax handling.

## Open for review

- The plan list and limits for launch (proposed: a free read-only tier, a Camp plan, a Group plan for multi-camp organisations).
- Whether trials need a card.
- What the free read-only tier includes, if anything beyond export.
