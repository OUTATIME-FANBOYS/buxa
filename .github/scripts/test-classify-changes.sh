#!/usr/bin/env bash
# Feeds sample changed-file lists to classify-changes.sh and checks which chunks run.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
classify="$here/classify-changes.sh"
chunks="install typecheck lint unit database build workflow"
fail=0

# check NAME EXPECTED_RUNS FILE...: EXPECTED_RUNS lists the chunks that must run, in the order of $chunks
check() {
  local name=$1 expected=$2
  shift 2
  local out got=""
  out=$(printf '%s\n' "$@" | "$classify")
  for chunk in $chunks; do
    if printf '%s\n' "$out" | grep -qx "run_$chunk=true"; then got="$got $chunk"; fi
  done
  got=${got# }
  local status=PASS
  if [ "$got" != "$expected" ]; then status=FAIL; fail=1; fi
  printf '%-30s %s  runs: %s\n' "$name" "$status" "${got:-(nothing)}"
}

check "only ci.yml changed" "workflow" .github/workflows/ci.yml
check "only apps/web/styles changed" "install typecheck lint unit build" apps/web/styles/globals.css
check "only packages/db/migrations" "install database" packages/db/migrations/0012_example.sql
check "only packages/db/test" "install typecheck lint database" packages/db/test/people-schema.test.ts
check "package.json changed" "install typecheck lint unit database build workflow" package.json
check "docs only" "install lint unit" docs/auth.md README.md
check "server code changed" "install typecheck lint unit database build" apps/server/src/config.ts
check "web integration test" "install typecheck lint database" apps/web/__tests__/integration/example.test.ts
check "unknown root file" "install typecheck lint unit database build workflow" docker-compose.yml
check "no changed files" ""

# With --all (diff unavailable) every chunk runs
all_out=$("$classify" --all < /dev/null)
if printf '%s\n' "$all_out" | grep -qx "run_build=true"; then
  printf '%-30s PASS  runs: %s\n' "--all (diff unavailable)" "install typecheck lint unit database build workflow"
else
  printf '%-30s FAIL\n' "--all (diff unavailable)"; fail=1
fi

exit $fail
