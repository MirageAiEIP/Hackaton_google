# Cloud Memorystore (Redis) Module

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_network_id" {
  type = string
}

# Redis Instance
resource "google_redis_instance" "cache" {
  name               = "samu-ai-redis-${var.environment}"
  tier               = var.environment == "production" ? "STANDARD_HA" : "BASIC"
  memory_size_gb     = var.environment == "production" ? 5 : 2
  region             = var.region
  project            = var.project_id
  redis_version      = "REDIS_7_0"
  display_name       = "SAMU AI Cache ${title(var.environment)}"
  authorized_network = var.vpc_network_id

  # High Availability (production seulement)
  replica_count      = var.environment == "production" ? 1 : 0
  read_replicas_mode = var.environment == "production" ? "READ_REPLICAS_ENABLED" : "READ_REPLICAS_DISABLED"

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  # Redis configuration
  redis_configs = {
    maxmemory-policy        = "allkeys-lru"
    notify-keyspace-events  = "Ex" # Keyspace notifications for expirations
    timeout                 = "300"
  }

  # Labels
  labels = {
    environment = var.environment
    service     = "samu-ai-triage"
    managed_by  = "terraform"
  }
}

# Outputs
output "redis_host" {
  value       = google_redis_instance.cache.host
  description = "Redis host IP address"
}

output "redis_port" {
  value       = google_redis_instance.cache.port
  description = "Redis port"
}

output "redis_url" {
  value       = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
  description = "Full Redis URL"
}

output "instance_name" {
  value = google_redis_instance.cache.name
}
