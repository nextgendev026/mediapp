locals {
  records = {
    api      = "api"
    supabase = "supabase"
    minio    = "minio"
    assets   = "assets"
  }
}

resource "cloudflare_record" "service" {
  for_each = local.records
  zone_id  = var.cloudflare_zone_id
  name     = each.value
  type     = "A"
  content  = var.vps_ipv4
  proxied  = true
  ttl      = 1
  comment  = "AfyaCommerce ${var.environment} service"
}

resource "cloudflare_record" "root" {
  zone_id  = var.cloudflare_zone_id
  name     = "@"
  type     = "A"
  content  = var.vps_ipv4
  proxied  = true
  ttl      = 1
  comment  = "AfyaCommerce ${var.environment} root"
}

resource "cloudflare_record" "www" {
  zone_id  = var.cloudflare_zone_id
  name     = "www"
  type     = "CNAME"
  content  = var.service_domain
  proxied  = true
  ttl      = 1
  comment  = "AfyaCommerce ${var.environment} web alias"
}

resource "null_resource" "vps_bootstrap" {
  count = var.enable_vps_bootstrap ? 1 : 0
  triggers = {
    environment = var.environment
    vps_ipv4    = var.vps_ipv4
    service     = var.service_domain
  }
  provisioner "local-exec" {
    command = "ssh -i ${var.vps_ssh_key_path} ${var.vps_ssh_user}@${var.vps_ipv4} 'sudo bash /opt/afyacommerce/infrastructure/scripts/bootstrap-kenya-vps.sh'"
  }
}
