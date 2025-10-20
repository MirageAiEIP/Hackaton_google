# Staging Environment Configuration

variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region"
  default     = "europe-west1"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "staging"
}

module "samu_staging" {
  source = "../../"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
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
