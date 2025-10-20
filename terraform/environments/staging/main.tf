# Staging Environment Configuration

terraform {
  backend "gcs" {
    bucket = "samu-ai-terraform-state"
    prefix = "staging"
  }
}

module "samu_staging" {
  source = "../../"

  project_id  = "samu-ai-474822"
  region      = "europe-west1"
  environment = "staging"
}

# Outputs
output "cloud_run_url" {
  value = module.samu_staging.cloud_run_url
}

output "database_connection_name" {
  value = module.samu_staging.database_connection_name
}

output "database_public_ip" {
  value = module.samu_staging.database_public_ip
}
