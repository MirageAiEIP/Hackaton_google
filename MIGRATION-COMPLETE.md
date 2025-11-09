# Migration Complète vers GaIA (gaia-477710)

## ✅ MIGRATION TERMINÉE

La migration de `samu-ai-474822` vers `gaia-477710` est **COMPLÈTE**.

### Ce qui a été fait automatiquement

#### 1. Google Cloud Project Setup ✅
- Nouveau projet créé: `gaia-477710`
- Billing activé
- APIs activées:
  - Secret Manager
  - Cloud Run
  - Cloud SQL
  - Cloud Storage
  - Resource Manager

#### 2. Service Account ✅
- Service account créé: `samu-ai-service@gaia-477710.iam.gserviceaccount.com`
- Permissions configurées:
  - `roles/secretmanager.secretAccessor`
  - `roles/cloudsql.client`
  - `roles/storage.objectAdmin`
- Clé JSON générée: `config/gaia-service-account-key.json`

#### 3. Secrets Migration ✅
- **44 secrets importés** depuis l'ancien projet
- Tous les environnements: dev, staging, production
- Vérification: `gcloud secrets list`

#### 4. Code Repository ✅
- Nouveau repo privé: `BitBricoleurs/GaIA`
- Branches poussées: `dev`, `staging`, `production`
- Remote ajouté: `git remote add gaia git@github.com:BitBricoleurs/GaIA.git`

#### 5. Configuration Files ✅
Tous les fichiers mis à jour avec le nouveau projet `gaia-477710`:

- `.github/workflows/deploy.yml`
- `terraform/environments/staging/main.tf`
- `terraform/environments/staging/import.tf`
- `terraform/environments/production/main.tf`
- `terraform/environments/production/import.tf`
- `src/config/index.async.ts`
- `src/services/secret-manager.service.ts`
- `docker-compose.yml`
- `scripts/db-backup.sh`
- `scripts/db-migrate.sh`
- `scripts/db-restore.sh`
- `scripts/test-secrets-simple.ts`

---

## 🚀 PROCHAINES ÉTAPES (À faire manuellement)

### Étape 1: Configurer GitHub Secrets (5 minutes)

**Script automatique fourni:**

```powershell
cd scripts
.\setup-github-secrets.ps1
```

Ce script va:
1. Encoder la clé du service account en base64
2. La copier dans votre clipboard
3. Vous donner les instructions pour créer les secrets GitHub

**Ou manuellement:**

1. Allez sur: https://github.com/BitBricoleurs/GaIA/settings/secrets/actions
2. Créez 2 secrets:
   - `GCP_SERVICE_ACCOUNT_KEY`: Contenu de `config/gaia-service-account-key.json` encodé en base64
   - `GCP_PROJECT_ID`: `gaia-477710`

### Étape 2: Configurer Terraform (10 minutes)

**Option A: Nouveau bucket de state (Recommandé)**

```bash
# Créer le bucket
gsutil mb -l europe-west1 gs://gaia-terraform-state/
gsutil versioning set on gs://gaia-terraform-state/

# Supprimer les anciens fichiers import.tf (ils référencent l'ancien projet)
rm terraform/environments/staging/import.tf
rm terraform/environments/production/import.tf
```

Ensuite, modifier `terraform/environments/staging/main.tf` et `terraform/environments/production/main.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "gaia-terraform-state"  # Changé!
    prefix = "staging" # ou "production"
  }
}
```

**Option B: State local (Plus simple pour commencer)**

Commentez le bloc `backend "gcs"` dans les fichiers Terraform.

### Étape 3: Premier Déploiement (15 minutes)

**Via GitHub Actions (Recommandé):**

```bash
# Une fois les GitHub Secrets configurés
git add .
git commit -m "chore: complete migration to gaia-477710"
git push gaia staging

# Surveillez le déploiement:
# https://github.com/BitBricoleurs/GaIA/actions
```

**Via CLI (Alternative):**

```bash
# Build & Deploy
gcloud builds submit --tag europe-west1-docker.pkg.dev/gaia-477710/samu-ai-triage/samu-ai-triage-staging:latest

gcloud run deploy samu-ai-triage-staging \
  --image europe-west1-docker.pkg.dev/gaia-477710/samu-ai-triage/samu-ai-triage-staging:latest \
  --platform managed \
  --region europe-west1 \
  --update-env-vars NODE_ENV=staging \
  --update-secrets DATABASE_URL=staging-database-url:latest,REDIS_URL=staging-redis-url:latest,ELEVENLABS_API_KEY=staging-elevenlabs-api-key:latest,ELEVENLABS_AGENT_ID=staging-elevenlabs-agent-id:latest,GOOGLE_API_KEY=staging-google-api-key:latest,TWILIO_ACCOUNT_SID=staging-twilio-account-sid:latest,TWILIO_AUTH_TOKEN=staging-twilio-auth-token:latest,TWILIO_PHONE_NUMBER=staging-twilio-phone-number:latest
```

### Étape 4: Mettre à jour les Webhooks (5 minutes)

Une fois déployé, vous aurez une URL Cloud Run. Mettez à jour:

#### Twilio
https://console.twilio.com/ → Phone Numbers → Votre numéro:
- Incoming Voice: `https://VOTRE_URL/api/v1/twilio/inbound`
- Status Callback: `https://VOTRE_URL/api/v1/twilio/post-call-webhook`

#### ElevenLabs
https://elevenlabs.io/ → Agent → Tools → Mettre à jour les 4 webhooks

---

## 📁 Fichiers Importants

### Scripts de Migration
- `scripts/export-secrets.ps1` - Export des secrets (utilisé ✅)
- `scripts/import-secrets-simple.ps1` - Import des secrets (utilisé ✅)
- `scripts/setup-github-secrets.ps1` - Helper pour GitHub Secrets ⚠️ À UTILISER
- `scripts/SETUP-NEW-PROJECT.md` - Guide complet étape par étape
- `scripts/migration-checklist.md` - Checklist détaillée

### Configuration
- `config/gaia-service-account-key.json` - ⚠️ NE PAS COMMITER
- `.github/workflows/deploy.yml` - Workflow CI/CD (mis à jour ✅)

---

## ⚠️ Sécurité

### Fichiers à NE JAMAIS commiter
- `config/gaia-service-account-key.json` ✅ Déjà dans `.gitignore`
- `config/samu-ai-474822-ad24ee114e83.json` ✅ Déjà dans `.gitignore`
- `secrets-backup/` ✅ Supprimé

### Clés à garder secrètes
- La clé JSON du service account
- Les secrets GitHub (GCP_SERVICE_ACCOUNT_KEY)

---

## 🧹 Nettoyage de l'ancien projet (Optionnel)

**⚠️ ATTENTION: Ne faites ceci QUE si vous êtes SÛR de ne plus avoir besoin de l'ancien projet!**

```bash
# Lister les ressources de l'ancien projet
gcloud config set project samu-ai-474822
gcloud run services list
gcloud sql instances list
gcloud secrets list

# Supprimer le projet (IRRÉVERSIBLE!)
# gcloud projects delete samu-ai-474822
```

---

## 📊 Checklist Complète

### Migration (Fait ✅)
- [x] Nouveau projet GCP créé
- [x] Billing activé
- [x] APIs activées
- [x] Service account créé
- [x] 44 secrets importés
- [x] Code repository forké vers BitBricoleurs/GaIA
- [x] Tous les fichiers de config mis à jour
- [x] Workflow GitHub Actions mis à jour

### Configuration (À faire ⚠️)
- [ ] GitHub Secrets configurés
- [ ] Terraform state backend configuré
- [ ] Terraform initialisé
- [ ] Premier déploiement réussi
- [ ] Webhooks Twilio mis à jour
- [ ] Webhooks ElevenLabs mis à jour
- [ ] Tests d'appels réussis

---

## 🆘 Support

### Commandes Utiles

```bash
# Voir les secrets
gcloud secrets list --project=gaia-477710

# Voir les services Cloud Run
gcloud run services list --project=gaia-477710

# Voir les logs
gcloud run logs read samu-ai-triage-staging --region=europe-west1

# Changer de projet
gcloud config set project gaia-477710
```

### Ressources
- Guide complet: `scripts/SETUP-NEW-PROJECT.md`
- Checklist: `scripts/migration-checklist.md`
- GitHub repo: https://github.com/BitBricoleurs/GaIA
- GCP Console: https://console.cloud.google.com/home/dashboard?project=gaia-477710

---

**Migration complétée le:** 2025-11-09
**Ancien projet:** samu-ai-474822
**Nouveau projet:** gaia-477710
**Nouveau repo:** BitBricoleurs/GaIA
