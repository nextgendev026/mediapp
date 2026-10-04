#!/usr/bin/env bash
set -Eeuo pipefail

: "${SERVICE_DOMAIN:?SERVICE_DOMAIN is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${ANON_KEY:?ANON_KEY is required}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

install -d -m 0750 /opt/afyacommerce /etc/afyacommerce /var/backups/afyacommerce
apt-get update
apt-get install -y ca-certificates curl gnupg ufw fail2ban postgresql-client
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
printf '%s\n' "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
systemctl enable --now fail2ban
install -m 0600 /dev/null /etc/afyacommerce/runtime.env
printf '%s\n' "SERVICE_DOMAIN=$SERVICE_DOMAIN" "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" "JWT_SECRET=$JWT_SECRET" "ANON_KEY=$ANON_KEY" "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" "MINIO_ROOT_USER=$MINIO_ROOT_USER" "MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD" > /etc/afyacommerce/runtime.env
chmod 0600 /etc/afyacommerce/runtime.env
