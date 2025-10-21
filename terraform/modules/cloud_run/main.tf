# Cloud Run Module

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "database_connection_name" {
  type = string
}

# Service Cloud Run
resource "google_cloud_run_v2_service" "samu_api" {
  name     = "samu-ai-triage-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    # Scaling configuration
    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 20 : 5
    }

    # Timeout
    timeout = "300s"

    # Service account (avec permissions pour Secret Manager)
    service_account = google_service_account.cloud_run_sa.email

    containers {
      # Image placeholder, sera remplacée par CI/CD
      image = "gcr.io/cloudrun/hello"

      ports {
        container_port = 8080
        name           = "http1"
      }

      # Resources
      resources {
        limits = {
          cpu    = var.environment == "production" ? "4" : "2"
          memory = var.environment == "production" ? "4Gi" : "2Gi"
        }

        cpu_idle = true
        startup_cpu_boost = true
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "LOG_LEVEL"
        value = var.environment == "production" ? "info" : "debug"
      }

      # Database URL (secret)
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-database-url"
            version = "latest"
          }
        }
      }

      # ElevenLabs (secrets)
      env {
        name = "ELEVENLABS_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-elevenlabs-api-key"
            version = "latest"
          }
        }
      }

      env {
        name = "ELEVENLABS_AGENT_ID"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-elevenlabs-agent-id"
            version = "latest"
          }
        }
      }

      # Google Gemini (secret)
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-google-api-key"
            version = "latest"
          }
        }
      }

      # Twilio (secrets)
      env {
        name = "TWILIO_ACCOUNT_SID"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-twilio-account-sid"
            version = "latest"
          }
        }
      }

      env {
        name = "TWILIO_AUTH_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-twilio-auth-token"
            version = "latest"
          }
        }
      }

      env {
        name = "TWILIO_PHONE_NUMBER"
        value_source {
          secret_key_ref {
            secret  = "${var.environment}-twilio-phone-number"
            version = "latest"
          }
        }
      }

      # Liveness probe
      liveness_probe {
        http_get {
          path = "/health/live"
          port = 8080
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3
      }

      # Startup probe
      startup_probe {
        http_get {
          path = "/health/ready"
          port = 8080
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 5
      }
    }

    # Max concurrent requests per instance
    max_instance_request_concurrency = 80

    # Labels
    labels = {
      environment = var.environment
      managed_by  = "terraform"
    }
  }

  # Traffic routing (100% to latest revision)
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # Image mise à jour par CI/CD
    ]
  }
}

# Service Account pour Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "samu-cloud-run-${var.environment}"
  display_name = "SAMU AI Cloud Run ${title(var.environment)}"
  project      = var.project_id
}

# IAM: Accès Secret Manager
resource "google_project_iam_member" "cloud_run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Accès Cloud SQL
resource "google_project_iam_member" "cloud_run_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Allow unauthenticated access (public API)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.samu_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_name" {
  value = google_cloud_run_v2_service.samu_api.name
}

output "service_url" {
  value       = google_cloud_run_v2_service.samu_api.uri
  description = "Cloud Run service URL"
}

output "service_account_email" {
  value = google_service_account.cloud_run_sa.email
}
