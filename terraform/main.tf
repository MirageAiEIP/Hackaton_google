# SAMU AI Triage System - Infrastructure Terraform
# Architecture multi-environnements (staging + production)

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Backend configuré par environnement (voir environments/)
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environment (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production"
  }
}

# Modules
module "database" {
  source = "./modules/database"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
}

module "secrets" {
  source = "./modules/secrets"

  project_id  = var.project_id
  environment = var.environment
}

module "cloud_run" {
  source = "./modules/cloud_run"

  project_id               = var.project_id
  region                   = var.region
  environment              = var.environment
  database_connection_name = module.database.connection_name

  depends_on = [
    module.database,
    module.secrets
  ]
}

module "monitoring" {
  source = "./modules/monitoring"

  project_id             = var.project_id
  environment            = var.environment
  cloud_run_service_name = module.cloud_run.service_name

  depends_on = [module.cloud_run]
}

# Outputs
output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = module.cloud_run.service_url
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = module.database.connection_name
}

output "database_public_ip" {
  description = "Cloud SQL public IP address"
  value       = module.database.public_ip_address
}
