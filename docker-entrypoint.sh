#!/bin/sh
# Optionally migrate, then start. If a migration fails the container exits, so the platform keeps serving the previous version.
set -eu
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying database migrations"
  node dist-api/cli.mjs
fi
exec node dist-api/server.mjs
