# Owner acceptance: the checks only the owner can do

These checks need the owner's phone, the production build, or an owner decision. No code is written for them. They run as one pass **after phase 4 is built**, so the owner can test the features of phases 1 to 4 together on real devices, instead of in pieces.

## When

- **Starts when:** phase 4 (`docs/phases/04-seats-rosters.md`) is built and merged to `Phase2`, and the production build runs.
- **Done when:** every check below is recorded in this file with the date, the device or account used, and the result. Failures become issues on the board.

## The checks

- [ ] **Phone timing** (#98). Staff check in a member in under 5 seconds on a real phone: 10 runs on iOS Safari and 10 on Android Chrome. The procedure and the results tables are in `docs/phases/01-check-in-timing.md`. The owner fills in the tables; nobody else writes results into them.
- [ ] **Install and sign in from a phone** (#99). Staff install the app to the home screen on iOS and Android, then sign in from it.
- [ ] **Signed-in walkthrough on the production build** (#100). Add a person, a membership, a badge, a scan, a check-in, an on-site entry, a check-out, and the export. Then check the viewer role.
- [ ] **Classes and on-site screens** (#101). The classes and on-site screens at 390px and 1280px, signed in.
- [ ] **Phase 3 and 4 screens.** Registration, seats, groups and rosters at 390px and 1280px, signed in, and the viewer role on each.

## Owner decisions

- [ ] **Production database: migrations and mock data** (#110). Decide whether migrations run during the production build or as a separate step, and whether mock data is loaded anywhere it could reach real camps.

## Results

Record each result here: date, device or account, the measured value or what was seen, and the link to the evidence.
