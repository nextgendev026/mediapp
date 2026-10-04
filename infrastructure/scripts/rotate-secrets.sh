#!/usr/bin/env bash
set -Eeuo pipefail

: "${SECRET_FILE:?SECRET_FILE is required}"

if [ ! -f "$SECRET_FILE" ]; then
  printf '%s\n' "secret file not found: $SECRET_FILE" >&2
  exit 1
fi
chmod 0600 "$SECRET_FILE"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
install -m 0600 "$SECRET_FILE" "${SECRET_FILE}.${timestamp}.bak"
find "$(dirname "$SECRET_FILE")" -maxdepth 1 -type f -name "$(basename "$SECRET_FILE").*.bak" -mtime +90 -delete
printf '%s\n' "secret rotation checkpoint created; update provider secrets before removing the backup"
