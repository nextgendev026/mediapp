output "service_records" {
  description = "DNS names created by Terraform"
  value = {
    root     = var.service_domain
    api      = "api.${var.service_domain}"
    supabase = "supabase.${var.service_domain}"
    minio    = "minio.${var.service_domain}"
    assets   = "assets.${var.service_domain}"
  }
}

output "vps_ipv4" {
  description = "Kenyan VPS address hosting health workloads"
  value       = var.vps_ipv4
}

output "bootstrap_enabled" {
  description = "Whether the VPS bootstrap provisioner is enabled"
  value       = var.enable_vps_bootstrap
}
