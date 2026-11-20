#!/usr/bin/env bash
# Decides which CI chunks run, from the changed files on stdin (one path per line).
# Prints GITHUB_OUTPUT-style lines: one boolean per area, then one run_<chunk> boolean per chunk.
# --all turns every chunk on. The workflow uses it when the diff cannot be computed.
set -euo pipefail

all=false
if [ "${1:-}" = "--all" ]; then all=true; fi
web=false web_integration=false server=false db=false db_test=false docs=false ci=false

while IFS= read -r file; do
  case "$file" in
    "") ;;
    # Package-level and shared tooling: every chunk runs.
    package.json | package-lock.json | */package.json | *tsconfig*.json | vitest.config.ts | eslint.config.mjs | test/*)
      all=true ;;
    .github/*) ci=true ;;
    # The docs-links test (unit chunk) reads README.md and docs/*.md. Docs changes also run the lint chunk for Prettier formatting.
    docs/* | *.md) docs=true ;;
    apps/web/__tests__/integration/*) web_integration=true ;;
    apps/web/*) web=true ;;
    apps/server/* | apps/shared/* | apps/middleware/* | packages/domain/* | packages/contracts/* | packages/db/src/* | scripts/*)
      server=true ;;
    # Migrations are only run by the database chunk. The database tests are Postgres-backed and run there too.
    packages/db/migrations/*) db=true ;;
    packages/db/test/*) db_test=true ;;
    # Anything not listed above runs everything, so a new area is never skipped by accident.
    *) all=true ;;
  esac
done

# flag VALUE...: prints "true" when any value is "true", otherwise "false"
flag() {
  for value in "$@"; do
    if [ "$value" = true ]; then echo true; return; fi
  done
  echo false
}

run_typecheck=$(flag "$all" "$web" "$web_integration" "$server" "$db_test")
run_lint=$(flag "$all" "$web" "$web_integration" "$server" "$db_test" "$docs")
run_unit=$(flag "$all" "$web" "$server" "$docs")
run_database=$(flag "$all" "$db" "$db_test" "$server" "$web_integration")
run_build=$(flag "$all" "$web" "$server")
run_workflow=$(flag "$all" "$ci")
run_install=$(flag "$run_typecheck" "$run_lint" "$run_unit" "$run_database" "$run_build")

cat <<OUT
web=$web
web_integration=$web_integration
server=$server
db=$db
db_test=$db_test
docs=$docs
ci=$ci
all=$all
run_install=$run_install
run_typecheck=$run_typecheck
run_lint=$run_lint
run_unit=$run_unit
run_database=$run_database
run_build=$run_build
run_workflow=$run_workflow
OUT
