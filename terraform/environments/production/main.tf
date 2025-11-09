# Production Environment Configuration

terraform {
  backend "gcs" {
    bucket = "samu-ai-terraform-state"
    prefix = "production"
  }
}

module "samu_production" {
  source = "../../"

  project_id  = "gaia-477710"
  region      = "europe-west1"
  environment = "production"
}

# Outputs
output "cloud_run_url" {
  value = module.samu_production.cloud_run_url
}

output "database_connection_name" {
  value = module.samu_production.database_connection_name
}

output "database_public_ip" {
  value = module.samu_production.database_public_ip
}
