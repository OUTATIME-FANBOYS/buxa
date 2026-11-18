# Contributing

How work gets named, checked, merged and released. The rules for the code are in [CODING_STANDARDS.md](CODING_STANDARDS.md).

## Branches

- `develop` is the default branch. Features and fixes merge here.
- `main` holds released work only. It is updated by one PR, `develop` to `main`, when a release ships. The release is then tagged.
- Branch names are `release/type/name`, where the release is the version the work ships in (`v0.N`), the type is `feat`, `fix`, `docs`, `chore`, `refactor` or `test`, and the name is short kebab-case. Examples: `v0.2/feat/phase-2-classes`, `v0.1/fix/audit-s02-viewer-access`.
- A branch is cut from `develop`. Do not commit to `develop` or `main` directly.

## Pull requests

- **Title:** `Buxa-<release>-<Type>-<Phase or area>-<Description>`. The type is one of five, capitalised:
  - **Feature:** a new capability users did not have before.
  - **Enhancement:** an improvement to something that already exists.
  - **Defect:** something that works but could be better: a weakness, an audit hardening item, a rough edge.
  - **Bug:** something that is broken.
  - **Chore:** a routine task: cleanup, upgrades, seeding, releases, tooling, docs and tests that do not change behaviour.
  Spaces are allowed in the description. Examples: `Buxa-v0.2-Feature-Phase2-Bulk Import`, `Buxa-v0.1.1-Bug-Security-Viewer Access`, `Buxa-v0.1.1-Chore-Lint-Add ESLint`. Commit messages keep the conventional form `type(scope): summary`.
- **Description:** use `.github/pull_request_template.md`. Its sections are What are we fixing, Why, How, How it was verified, and Risks and follow-ups. Keep the emoji headings the template gives. Do not add more emoji in the text.
- **Base:** feature and fix PRs target `develop`. Release PRs target `main` and must come from `develop`; the `Branch flow` check enforces this.
- **Commit messages** use the conventional form `type(scope): summary`, for example `feat(attendance): record check-out pickup`.
- **AI-assisted commits** end with a `Co-Authored-By:` line naming the assistant that wrote the change.
- **Secrets:** never commit secrets or `.env` files. `.env.example` (with no values) is the only env file in the repo. If a secret is committed by mistake, rotate it first, then remove it from history.
- **New features** need their phase spec in `docs/phases/` before the code is written. The spec's exit criteria are what the PR is checked against.

## Before opening a PR

Use Node 22, as CI does. Run these from the repo root. CI runs them as ordered chunks (`.github/workflows/ci.yml`): typecheck, lint, unit tests, database tests and build. The umbrella check, **Verify build**, fails if a chunk that should run does not pass.

```bash
npm run typecheck
npm run lint
npm test            # database tests run only when DATABASE_URL is set; npm run test:unit and npm run test:db run the two halves
npm run build
```

Database tests need the local database: `docker compose up -d db`, then `export DATABASE_URL=postgres://buxa:buxa@localhost:5433/buxa`.

## Testing

Vitest is the unit test runner for the whole repo, including `apps/web`, `packages/*` and `test/`. Next.js does not replace it: `npm test` runs `vitest run` from the root.

## Merging

- **Work branches into a phase branch:** feature and fix PRs are **squash-merged** into their phase branch, one commit per feature.
- **Phase branch into `develop`:** a **merge commit** (not squash, not rebase). The phase's history stays visible.
- **`develop` into `main`:** a **merge commit**, then the version tag (`vX.Y.Z`) on the `main` commit.
- Nothing merges into `develop` by squash or rebase. Phase branches may be renamed later; the rule applies to whatever branch merges into `develop`.
- Do not merge a phase until its tests pass and its exit criteria in `docs/phases/` are met.

## Release

1. Confirm `develop` is green and the exit criteria of the phases in this release are met (`docs/phases/`).
2. Open the release PR from `develop` to `main` and fill in the template.
3. Merge it with a merge commit.
4. Tag the `main` commit `vX.Y.Z` and push the tag.

Tags so far: `v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.1.3-release`, `v0.2.1` and `v0.2.2`. `v0.1.3-release` and `v0.2.2` are on `main`.

## Enforcement

GitHub branch protection is not available on this plan (private repo, free org). Until it is, these rules are enforced by CI and by review. When the org moves to GitHub Team, require the PR and the **Verify build** check on `develop` and `main`, require `Branch flow` on `main`, and block force pushes and deletions on both.

## Work outside the phase

Every change tracks a board issue. Most changes belong to the phase in progress and their issue carries the phase label.

If a request does not fit the phase requirements (a new feature, a fix to a finished phase, or an idea from the owner that the spec does not cover), then:

1. Open an issue with the title of the work and a short body: what was asked, which phase it would belong to, and why it is outside the current phase. Label it `feat`, `fix`, `chore` or `docs`, add the phase label it belongs to, and add `outside-phase` if it is not in the spec.
2. Add it to the Buxa project board, with status **Todo**.
3. Open the PR with "Closes #n" in its body. The PR board link check warns without one.
4. The board moves the item as the work goes on: the PR opens and the item goes to **In Progress**, and merging closes the issue and moves it to **Done**.

Phase work follows the same steps, with its phase label and the phase spec as its reference.

Two project automations make this work. Set them in the board's settings (Workflows): "Auto-add items" for this repository, and the built-in status rules for pull requests and closed issues. The repository check (`.github/workflows/pr-board-link.yml`) warns when a PR has no linked issue; it does not block the PR.
