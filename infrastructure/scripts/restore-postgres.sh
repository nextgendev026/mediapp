#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

if [ ! -f "$BACKUP_FILE" ]; then
  printf '%s\n' "backup file not found: $BACKUP_FILE" >&2
  exit 1
fi
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase "$BACKUP_ENCRYPTION_KEY" --decrypt "$BACKUP_FILE" > "$temporary"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" "$temporary"
printf '%s\n' "restore completed from $BACKUP_FILE"
