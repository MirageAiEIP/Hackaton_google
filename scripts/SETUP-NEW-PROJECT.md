# Configuration du Nouveau Projet GaIA (gaia-477710)

## Récapitulatif de ce qui est FAIT

✅ **Projet Google Cloud configuré**
- Project ID: `gaia-477710`
- Billing activé
- APIs activées (Secret Manager, Cloud Run, Cloud SQL, Storage)
- Service account créé: `samu-ai-service@gaia-477710.iam.gserviceaccount.com`
- Clé JSON générée: `config/gaia-service-account-key.json`

✅ **Secrets importés**
- 44 secrets importés dans Google Secret Manager

✅ **Code mis à jour**
- Tous les fichiers `.tf`, `.ts`, `.yml`, `.sh` mis à jour avec le nouveau projet
- Nouveau repo GitHub: `BitBricoleurs/GaIA`
- Branches `dev`, `staging`, `production` poussées

---

## ÉTAPES RESTANTES

### 1. Configurer les GitHub Secrets (IMPORTANT!)

Le workflow GitHub Actions (`.github/workflows/deploy.yml`) utilise Workload Identity Federation OU une clé JSON de service account.

#### Option A: Utiliser une clé JSON (Plus simple pour commencer)

**1. Encoder la clé JSON en base64:**

```powershell
# Windows PowerShell
$content = Get-Content config\gaia-service-account-key.json -Raw
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
Write-Host "Service account key copied to clipboard!"
```

**2. Ajouter les secrets GitHub:**

Allez sur: `https://github.com/BitBricoleurs/GaIA/settings/secrets/actions`

Créez ces secrets:

| Nom du secret | Valeur |
|---------------|--------|
| `GCP_SERVICE_ACCOUNT_KEY` | Collez le contenu base64 du clipboard |
| `GCP_PROJECT_ID` | `gaia-477710` |

**3. Modifier le workflow pour utiliser la clé JSON:**

Le fichier `.github/workflows/deploy.yml` doit être modifié:

```yaml
# Remplacer ces lignes (61-65):
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

# Par:
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}
```

#### Option B: Workload Identity Federation (Recommandé en production)

Voir: https://github.com/google-github-actions/auth#workload-identity-federation

---

### 2. Terraform - Nouveau State Backend

Votre Terraform utilise actuellement un backend GCS qui n'existe plus:

```hcl
terraform {
  backend "gcs" {
    bucket = "samu-ai-terraform-state"
    prefix = "production"
  }
}
```

**Deux options:**

#### Option A: Créer un nouveau bucket Terraform State

```bash
# Créer le bucket
gsutil mb -l europe-west1 gs://gaia-terraform-state/

# Activer le versioning
gsutil versioning set on gs://gaia-terraform-state/

# Mettre à jour terraform/environments/staging/main.tf
```

Remplacer:
```hcl
terraform {
  backend "gcs" {
    bucket = "samu-ai-terraform-state"
    prefix = "staging"
  }
}
```

Par:
```hcl
terraform {
  backend "gcs" {
    bucket = "gaia-terraform-state"
    prefix = "staging"
  }
}
```

Même chose pour `terraform/environments/production/main.tf`.

#### Option B: Commencer sans backend distant (local)

Commentez temporairement le bloc `backend "gcs"` et utilisez le state local:

```hcl
# terraform {
#   backend "gcs" {
#     bucket = "gaia-terraform-state"
#     prefix = "staging"
#   }
# }
```

Terraform créera un fichier `terraform.tfstate` localement.

---

### 3. Initialiser Terraform pour le nouveau projet

```bash
cd terraform/environments/staging

# Initialiser Terraform
terraform init

# (Si vous avez changé de backend)
terraform init -migrate-state

# Planifier (vérifier ce qui sera créé)
terraform plan

# Appliquer (ATTENTION: va créer infrastructure)
# terraform apply
```

**⚠️ IMPORTANT:** Les fichiers `import.tf` ne sont plus valides car ils font référence aux secrets de l'ancien projet. Vous avez deux options:

1. **Supprimer les fichiers `import.tf`** (recommandé pour repartir de zéro)
   ```bash
   rm terraform/environments/staging/import.tf
   rm terraform/environments/production/import.tf
   ```

2. **Ou les garder mais ne pas les exécuter** (Terraform ignorera les imports déjà effectués)

---

### 4. Déployer l'application

Une fois GitHub Secrets configurés, vous pouvez déployer:

#### Via GitHub Actions (Recommandé)

```bash
# Pousser sur la branche staging pour déployer automatiquement
git push gaia staging

# Ou déclencher manuellement via l'interface GitHub Actions
```

#### Via la ligne de commande

```bash
# Construire et pousser l'image Docker
gcloud builds submit --tag europe-west1-docker.pkg.dev/gaia-477710/samu-ai-triage/samu-ai-triage-staging:latest

# Déployer sur Cloud Run
gcloud run deploy samu-ai-triage-staging \
  --image europe-west1-docker.pkg.dev/gaia-477710/samu-ai-triage/samu-ai-triage-staging:latest \
  --platform managed \
  --region europe-west1 \
  --update-env-vars NODE_ENV=staging \
  --update-secrets DATABASE_URL=staging-database-url:latest,REDIS_URL=staging-redis-url:latest,ELEVENLABS_API_KEY=staging-elevenlabs-api-key:latest,ELEVENLABS_AGENT_ID=staging-elevenlabs-agent-id:latest,GOOGLE_API_KEY=staging-google-api-key:latest,TWILIO_ACCOUNT_SID=staging-twilio-account-sid:latest,TWILIO_AUTH_TOKEN=staging-twilio-auth-token:latest,TWILIO_PHONE_NUMBER=staging-twilio-phone-number:latest
```

---

### 5. Mettre à jour les Webhooks

Une fois déployé, vous aurez une URL Cloud Run (ex: `https://samu-ai-triage-staging-xxx-ew.a.run.app`).

#### Twilio

Console: https://console.twilio.com/

Phone Numbers → Votre numéro → Configure:

- **Incoming Voice:** `https://VOTRE_URL/api/v1/twilio/inbound`
- **Status Callback:** `https://VOTRE_URL/api/v1/twilio/post-call-webhook`

#### ElevenLabs

Dashboard: https://elevenlabs.io/app/conversational-ai

Agent → Tools → Mettre à jour les 4 webhooks:

1. `dispatch_smur`: `https://VOTRE_URL/api/v1/test/dispatch-smur`
2. `get_patient_history`: `https://VOTRE_URL/api/v1/tools/get_patient_history`
3. `get_pharmacy_on_duty`: `https://VOTRE_URL/api/v1/tools/get_pharmacy_on_duty`
4. `request_human_handoff`: `https://VOTRE_URL/api/v1/tools/request_human_handoff`

---

### 6. Tests

```bash
# Health check
curl https://VOTRE_URL_CLOUD_RUN/health

# Tester un appel Twilio
# Appelez votre numéro Twilio et vérifiez que l'agent répond
```

---

## Checklist Finale

- [ ] GitHub Secrets configurés (`GCP_SERVICE_ACCOUNT_KEY`, `GCP_PROJECT_ID`)
- [ ] Workflow GitHub Actions mis à jour (authentification)
- [ ] Terraform state backend configuré (bucket créé)
- [ ] Terraform initialisé (`terraform init`)
- [ ] Fichiers `import.tf` supprimés ou ignorés
- [ ] Application déployée sur Cloud Run (staging)
- [ ] Webhooks Twilio configurés
- [ ] Webhooks ElevenLabs configurés
- [ ] Tests d'appels Twilio réussis
- [ ] Handoff opérateur testé et fonctionnel

---

## Commandes Utiles

```bash
# Voir les secrets dans le nouveau projet
gcloud secrets list --project=gaia-477710

# Voir les services Cloud Run
gcloud run services list --project=gaia-477710

# Voir les logs
gcloud run logs read samu-ai-triage-staging --region=europe-west1 --limit=100

# Se connecter au nouveau projet
gcloud config set project gaia-477710

# Revenir à l'ancien projet (si besoin)
gcloud config set project samu-ai-474822
```

---

## Troubleshooting

### Erreur: "Permission denied" dans GitHub Actions

Vérifiez que le service account a les bonnes permissions:

```bash
gcloud projects add-iam-policy-binding gaia-477710 \
  --member="serviceAccount:samu-ai-service@gaia-477710.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding gaia-477710 \
  --member="serviceAccount:samu-ai-service@gaia-477710.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### Erreur: Terraform state locked

```bash
# Forcer le unlock (ATTENTION!)
terraform force-unlock LOCK_ID
```

### Base de données manquante

Si vous utilisez Cloud SQL, Terraform le créera automatiquement. Sinon, utilisez PostgreSQL local avec Docker:

```bash
docker-compose up postgres -d
```

---

**Prochaine étape recommandée:** Configurer les GitHub Secrets et tester un déploiement staging.
