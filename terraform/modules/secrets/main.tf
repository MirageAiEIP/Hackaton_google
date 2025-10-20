# Secret Manager Module

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

# Secrets pour l'environnement
locals {
  secrets = {
    elevenlabs-api-key  = "ElevenLabs API Key"
    elevenlabs-agent-id = "ElevenLabs Agent ID"
    google-api-key      = "Google Gemini API Key"
    twilio-account-sid  = "Twilio Account SID"
    twilio-auth-token   = "Twilio Auth Token"
    twilio-phone-number = "Twilio Phone Number"
  }
}

# Créer tous les secrets
resource "google_secret_manager_secret" "secrets" {
  for_each = local.secrets

  secret_id = "${var.environment}-${each.key}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  replication {
    auto {}
  }
}

# Note: Les valeurs doivent être ajoutées manuellement ou via script
# Exemple: gcloud secrets versions add staging-elevenlabs-api-key --data-file=-

# Outputs
output "secret_ids" {
  value = {
    for k, v in google_secret_manager_secret.secrets : k => v.secret_id
  }
  description = "Map of secret names to their IDs"
}

output "elevenlabs_api_key_name" {
  value = google_secret_manager_secret.secrets["elevenlabs-api-key"].secret_id
}

output "elevenlabs_agent_id_name" {
  value = google_secret_manager_secret.secrets["elevenlabs-agent-id"].secret_id
}

output "google_api_key_name" {
  value = google_secret_manager_secret.secrets["google-api-key"].secret_id
}

output "twilio_account_sid_name" {
  value = google_secret_manager_secret.secrets["twilio-account-sid"].secret_id
}

output "twilio_auth_token_name" {
  value = google_secret_manager_secret.secrets["twilio-auth-token"].secret_id
}

output "twilio_phone_number_name" {
  value = google_secret_manager_secret.secrets["twilio-phone-number"].secret_id
}
