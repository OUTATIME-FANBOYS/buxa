# Contributing

## Branches
- `develop` is the default branch. Every feature and fix merges here.
- `main` is released work only. It is updated by one PR, `develop` → `main`, at the end of a major release, then tagged `vX.Y.0`.
- Work happens on short-lived branches off `develop`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.

## Code
Follow `CODING_STANDARDS.md` (layout, types, state machines, patterns, security, tests).

## Pull requests
- Target `develop`. CI (`verify`) must pass: typecheck, tests (including database tests), build.
- Merge feature/fix PRs with **squash**. Merge the release PR (`develop` → `main`) with a **merge commit** so the two branches don't diverge.
- Conventional commit titles: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- Delete the branch after merging (done automatically).

## Release
1. Confirm `develop` is green and the phase exit criteria in `docs/phases/` are met.
2. Open a PR `develop` → `main`; the `Only from develop` check enforces the source.
3. Merge with a merge commit, then tag: `git tag v0.N.0 && git push --tags`.

## Enforcement
GitHub branch protection is not available on this plan (private repo, free org). Until it is enabled, these rules are enforced by CI
and convention. When the org moves to GitHub Team, apply: require PR + `verify` check on `develop` and `main`, require `Only from develop`
on `main`, block force pushes and deletions, include administrators.

## Branches, pull request titles and descriptions

- **Branches:** `release/type/name`, for example `v0.2/feat/phase-2-classes` or `v0.1/fix/audit-s02-viewer-access`. The release is the version the work ships in (`v0.N`), the type is `feat`, `fix`, `docs`, `chore`, `refactor` or `test`, and the name is short kebab-case.
- **Title:** `Buxa-<release>-<Type>-<Phase or area>-<Description>`. The type is one of four, capitalised:
  - **Feature:** a new capability users did not have before.
  - **Enhancement:** an improvement to something that already exists, including refactors, docs, tests and chores.
  - **Defect:** something that works but could be better: a weakness, an audit hardening item, a rough edge.
  - **Bug:** something that is broken.
  Spaces are allowed in the description. Examples: `Buxa-v0.2-Feature-Phase2-Bulk Import`, `Buxa-v0.1.1-Bug-Security-Viewer Access`, `Buxa-v0.1.1-Defect-Auth-Warning logs`. Commit messages keep the conventional form `type(scope): summary`.
- **Body:** use the template (`.github/pull_request_template.md`): What are we fixing, Why, How, How it was verified, Risks and follow-ups.
- **Emojis:** the template's section headings carry them. Keep them; do not add more inside the text.
