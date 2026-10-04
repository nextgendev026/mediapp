#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/var/backups/afyacommerce/postgres-${timestamp}.dump.gpg"
temporary="${target}.tmp"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" | gpg --batch --yes --symmetric --pinentry-mode loopback --passphrase "$BACKUP_ENCRYPTION_KEY" --output "$temporary"
mc alias set backup "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
mc cp "$temporary" "backup/${BACKUP_BUCKET}/"
rm -f "$temporary"
find /var/backups/afyacommerce -type f -name 'postgres-*.dump.gpg' -mtime +30 -delete
printf '%s\n' "backup completed: ${timestamp}"
