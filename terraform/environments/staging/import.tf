# Import des ressources existantes créées manuellement
# À exécuter UNE SEULE FOIS pour synchroniser Terraform avec l'existant

# Import des secrets staging
import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["redis-url"]
  id = "projects/gaia-477710/secrets/staging-redis-url"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["elevenlabs-api-key"]
  id = "projects/gaia-477710/secrets/staging-elevenlabs-api-key"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["elevenlabs-agent-id"]
  id = "projects/gaia-477710/secrets/staging-elevenlabs-agent-id"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["google-api-key"]
  id = "projects/gaia-477710/secrets/staging-google-api-key"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["twilio-account-sid"]
  id = "projects/gaia-477710/secrets/staging-twilio-account-sid"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["twilio-auth-token"]
  id = "projects/gaia-477710/secrets/staging-twilio-auth-token"
}

import {
  to = module.samu_staging.module.secrets.google_secret_manager_secret.secrets["twilio-phone-number"]
  id = "projects/gaia-477710/secrets/staging-twilio-phone-number"
}

# Import database secrets
import {
  to = module.samu_staging.module.database.google_secret_manager_secret.db_password
  id = "projects/gaia-477710/secrets/staging-database-password"
}

import {
  to = module.samu_staging.module.database.google_secret_manager_secret.database_url
  id = "projects/gaia-477710/secrets/staging-database-url"
}
