# Cloud SQL PostgreSQL Module

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}


# Cloud SQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "samu-ai-db-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region
  project          = var.project_id

  # Deletion protection (production seulement)
  deletion_protection = var.environment == "production"

  settings {
    # Tier selon environnement
    tier = var.environment == "production" ? "db-custom-4-16384" : "db-custom-2-7680"

    # High Availability (production seulement)
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"

    # Disk
    disk_type       = "PD_SSD"
    disk_size       = var.environment == "production" ? 100 : 50
    disk_autoresize = true
    disk_autoresize_limit = var.environment == "production" ? 500 : 200

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # 3 AM UTC
      point_in_time_recovery_enabled = var.environment == "production"
      transaction_log_retention_days = var.environment == "production" ? 7 : 3

      backup_retention_settings {
        retained_backups = var.environment == "production" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window
    maintenance_window {
      day          = 7 # Sunday
      hour         = 4 # 4 AM UTC
      update_track = "stable"
    }

    # IP configuration (Public IP with SSL)
    ip_configuration {
      ipv4_enabled    = true
      require_ssl     = true

      # Allow connections from Cloud Run
      authorized_networks {
        name  = "allow-cloud-run"
        value = "0.0.0.0/0"
      }
    }

    # Insights (monitoring)
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
    }

    # Database flags
    database_flags {
      name  = "max_connections"
      value = var.environment == "production" ? "200" : "100"
    }

    database_flags {
      name  = "shared_buffers"
      value = var.environment == "production" ? "4194304" : "2097152" # 4GB / 2GB en pages (8KB)
    }

    database_flags {
      name  = "work_mem"
      value = "16384" # 16MB
    }

    database_flags {
      name  = "maintenance_work_mem"
      value = "524288" # 512MB
    }

    # pgvector extension
    database_flags {
      name  = "cloudsql.enable_pgvector"
      value = "on"
    }
  }
}

# Database
resource "google_sql_database" "samu_db" {
  name     = "samu_triage"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

# Database User (password stocké dans Secret Manager)
resource "google_sql_user" "db_user" {
  name     = "samu_app"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Generate random password
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.environment}-database-password"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Outputs
output "connection_name" {
  value       = google_sql_database_instance.postgres.connection_name
  description = "Cloud SQL connection name"
}

output "instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "database_name" {
  value = google_sql_database.samu_db.name
}

output "public_ip_address" {
  value       = google_sql_database_instance.postgres.public_ip_address
  description = "Public IP address of the database"
}

output "database_url" {
  value       = "postgresql://${google_sql_user.db_user.name}:${random_password.db_password.result}@${google_sql_database_instance.postgres.public_ip_address}:5432/${google_sql_database.samu_db.name}?sslmode=require"
  sensitive   = true
  description = "Full DATABASE_URL connection string"
}
