# Backup and restore drill

## Daily backup

The backup job runs `pg_dump` against the Kenyan PostgreSQL service, encrypts the dump with the approved backup key, uploads it to the private MinIO bucket, and removes only expired local temporary files. Database and MinIO credentials are supplied through the secret manager.

## Drill procedure

1. Select the most recent encrypted backup and verify its object version and checksum.
2. Create an isolated restore database on a non-production Kenyan host.
3. Export `BACKUP_FILE`, `DATABASE_URL`, and `BACKUP_ENCRYPTION_KEY` through the secret manager.
4. Run `restore-postgres.sh` against the isolated database.
5. Verify schema version, RLS, representative patient records, audit count, and MinIO object access.
6. Record recovery time, data loss window, and evidence links.
7. Destroy the isolated restore after approval.

## Targets

- Recovery point objective: 24 hours or better
- Recovery time objective: 4 hours or better
- Drill frequency: quarterly
- Failure escalation: SEV-2 if a backup cannot be restored or if the data loss window exceeds the RPO
