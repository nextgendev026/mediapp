#!/usr/bin/env bash
set -Eeuo pipefail

: "${SERVICE_DOMAIN:?SERVICE_DOMAIN is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"

curl --fail --silent --show-error --max-time 15 "https://${SERVICE_DOMAIN}/healthz" >/dev/null
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null
printf '%s\n' "infrastructure smoke test passed"
