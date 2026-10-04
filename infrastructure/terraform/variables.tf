variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "production"
}

variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token supplied through TF_VAR_cloudflare_api_token"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for the service domain"
}

variable "service_domain" {
  type        = string
  description = "Public service domain"
  default     = "afyacommerce.co.ke"
}

variable "vps_ipv4" {
  type        = string
  description = "Kenyan VPS IPv4 address"
}

variable "vps_ssh_user" {
  type        = string
  description = "Bootstrap SSH user"
  default     = "deploy"
}

variable "vps_ssh_key_path" {
  type        = string
  description = "Path to the restricted SSH private key"
  default     = "~/.ssh/afyacommerce_deploy"
}

variable "enable_vps_bootstrap" {
  type        = bool
  description = "Run the idempotent VPS bootstrap provisioner"
  default     = false
}

variable "backup_bucket" {
  type        = string
  description = "MinIO bucket for encrypted backups"
  default     = "afyacommerce-backups"
}
