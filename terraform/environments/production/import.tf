# Import des ressources existantes créées manuellement
# À exécuter UNE SEULE FOIS pour synchroniser Terraform avec l'existant

# Import des secrets production
import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["redis-url"]
  id = "projects/samu-ai-474822/secrets/production-redis-url"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["elevenlabs-api-key"]
  id = "projects/samu-ai-474822/secrets/production-elevenlabs-api-key"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["elevenlabs-agent-id"]
  id = "projects/samu-ai-474822/secrets/production-elevenlabs-agent-id"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["google-api-key"]
  id = "projects/samu-ai-474822/secrets/production-google-api-key"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["twilio-account-sid"]
  id = "projects/samu-ai-474822/secrets/production-twilio-account-sid"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["twilio-auth-token"]
  id = "projects/samu-ai-474822/secrets/production-twilio-auth-token"
}

import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["twilio-phone-number"]
  id = "projects/samu-ai-474822/secrets/production-twilio-phone-number"
}

# Import du secret public-api-url (nouveau)
import {
  to = module.samu_production.module.secrets.google_secret_manager_secret.secrets["public-api-url"]
  id = "projects/samu-ai-474822/secrets/production-public-api-url"
}

# Import du service Cloud Run existant
import {
  to = module.samu_production.module.cloud_run.google_cloud_run_v2_service.samu_api
  id = "projects/samu-ai-474822/locations/europe-west1/services/samu-ai-triage-production"
}
