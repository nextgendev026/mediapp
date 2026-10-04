# Deployment runbook

## Preconditions

- A Kenyan VPS meets the capacity plan and has a restricted deploy SSH key.
- DNS zone access and the Cloudflare API token are stored in the deployment secret manager.
- PostgreSQL, MinIO, Caddy, and the official Supabase services use the `afyacommerce` network.
- `AUDIT_LOG_RETENTION_DAYS=2190` is present in the production environment.
- Regulatory evidence and licence expiry checks are complete.

## Deploy

```bash
cd infrastructure/terraform
terraform fmt -check
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
cd ../docker
cp .env.example .env
chmod 0600 .env
docker compose config
docker compose up -d
```

Apply database migrations from the controlled Supabase deployment process, then run:

```bash
../scripts/smoke-test.sh
```

## Rollback

1. Stop the application deployment and preserve logs.
2. Restore the previous application artifact.
3. Do not roll back a schema migration without an approved data recovery plan.
4. If a data-plane fault is suspected, isolate the service, preserve evidence, and follow the incident response runbook.
5. Record the rollback, owner, timestamps, and verification results.

## Post-deploy checks

- API health and authentication checks pass.
- RLS checks confirm no cross-patient reads.
- A sandbox M-PESA payment completes without exposing the service-role key.
- A rider offer, acceptance, GPS update, photo proof, and OTP proof can be completed.
- Backup creation and encryption succeed.
