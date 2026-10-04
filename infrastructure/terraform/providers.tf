provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "local" {}

provider "null" {}
