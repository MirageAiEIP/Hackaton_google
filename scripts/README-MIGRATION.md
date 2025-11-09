# Scripts de Migration Google Cloud

## Vue d'ensemble

Ces scripts automatisent la migration de votre projet SAMU AI d'un compte Google Cloud vers un autre.

**⏱️ Temps estimé total: ~1h30**

---

## 📋 Prérequis

1. **gcloud CLI installé et configuré**
   ```powershell
   gcloud --version
   ```

2. **Accès aux deux comptes Google Cloud**
   - Ancien compte (actuellement: `lagasse.alexandre@gmail.com`)
   - Nouveau compte

3. **Projet actuel: `samu-ai-474822`**

---

## 🚀 Étape 1: Export depuis l'ancien projet

### 1.1 Se connecter à l'ancien compte

```powershell
gcloud auth login
# Sélectionnez: lagasse.alexandre@gmail.com

gcloud config set project samu-ai-474822
```

### 1.2 Exporter tous les secrets (44 secrets)

```powershell
cd scripts
.\export-secrets.ps1 ..\secrets-backup
```

**Résultat attendu:**
- ✅ 44 fichiers créés dans `secrets-backup/`
- Chaque fichier contient la valeur du secret correspondant

### 1.3 Vérifier l'export

```powershell
ls ..\secrets-backup | measure
# Devrait afficher: Count = 44
```

**⚠️ IMPORTANT:**
- Ces fichiers contiennent des **données sensibles** (API keys, passwords, tokens)
- Ne JAMAIS les commiter dans git (déjà dans `.gitignore`)
- Les supprimer après la migration réussie

---

## 🔄 Étape 2: Setup du nouveau projet

### 2.1 Créer le nouveau projet Google Cloud

Via Console: https://console.cloud.google.com/

1. Cliquez sur le sélecteur de projet (en haut)
2. "NEW PROJECT"
3. Nom: `SAMU AI Triage` (ou autre)
4. Project ID: ex. `samu-ai-new-123456`
5. CREATE

### 2.2 Se connecter au nouveau compte

```powershell
gcloud auth login
# Sélectionnez votre NOUVEAU compte Google

gcloud config set project VOTRE_NOUVEAU_PROJECT_ID
```

### 2.3 Activer les APIs nécessaires

```powershell
gcloud services enable secretmanager.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

**⏱️ Durée: ~2-3 minutes**

### 2.4 Créer le Service Account

```powershell
# Créer le service account
gcloud iam service-accounts create samu-ai-service `
  --display-name="SAMU AI Service Account"

# Donner les permissions
$PROJECT_ID = gcloud config get-value project

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:samu-ai-service@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:samu-ai-service@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:samu-ai-service@$PROJECT_ID.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"
```

---

## 📥 Étape 3: Import des secrets

```powershell
cd scripts
.\import-secrets.ps1 -NewProjectId "VOTRE_NOUVEAU_PROJECT_ID" -SecretsDir "..\secrets-backup"
```

**Résultat attendu:**
- ✅ 44 secrets créés dans le nouveau projet

### Vérifier l'import

```powershell
gcloud secrets list
# Devrait lister 44 secrets
```

---

## 🗄️ Étape 4: Infrastructure (Optionnel)

### Cloud SQL PostgreSQL

Si vous voulez utiliser Cloud SQL au lieu de PostgreSQL local:

```powershell
# Créer l'instance
gcloud sql instances create samu-ai-db `
  --database-version=POSTGRES_16 `
  --tier=db-f1-micro `
  --region=europe-west4 `
  --storage-type=SSD `
  --storage-size=10GB

# Créer la base de données
gcloud sql databases create samu_triage --instance=samu-ai-db

# Créer un utilisateur
gcloud sql users create samu_user `
  --instance=samu-ai-db `
  --password=VotrePasswordSecure123!

# Obtenir l'IP de connexion
gcloud sql instances describe samu-ai-db --format="value(ipAddresses[0].ipAddress)"
```

**⚠️ Important:** Mettez à jour le secret `staging-database-url` avec la nouvelle URL de connexion.

### Redis (Cloud Memorystore)

```powershell
gcloud redis instances create samu-ai-redis `
  --size=1 `
  --region=europe-west4 `
  --tier=basic
```

**⏱️ Durée: ~10-15 minutes**

---

## 🚢 Étape 5: Déploiement

### 5.1 Fork le repository

Sur GitHub:
1. Allez sur votre repo actuel
2. Cliquez "Fork"
3. Créez le fork dans votre nouveau compte

### 5.2 Cloner le nouveau repo

```powershell
git clone https://github.com/VOTRE_NOUVEAU_COMPTE/Hackaton_google.git samu-ai-new
cd samu-ai-new
```

### 5.3 Mettre à jour les fichiers de déploiement

**`.github/workflows/deploy-staging.yml`:**

Remplacez:
```yaml
PROJECT_ID: "samu-ai-474822"
SERVICE_ACCOUNT: "samu-ai-service@samu-ai-474822.iam.gserviceaccount.com"
```

Par:
```yaml
PROJECT_ID: "VOTRE_NOUVEAU_PROJECT_ID"
SERVICE_ACCOUNT: "samu-ai-service@VOTRE_NOUVEAU_PROJECT_ID.iam.gserviceaccount.com"
```

**`.github/workflows/deploy-production.yml`:**

Même chose.

### 5.4 Déployer sur Cloud Run

```powershell
# Staging
.\scripts\deploy-google-cloud.sh staging

# Production
.\scripts\deploy-google-cloud.sh production
```

**⏱️ Durée: ~5-10 minutes par environnement**

---

## 📞 Étape 6: Configuration externe

### Twilio

Console Twilio → Phone Numbers → Votre numéro → Configure

**Incoming Voice:**
```
https://VOTRE_URL_CLOUD_RUN/api/v1/twilio/inbound
```

**Status Callback:**
```
https://VOTRE_URL_CLOUD_RUN/api/v1/twilio/post-call-webhook
```

### ElevenLabs

Dashboard ElevenLabs → Agent → Tools

Mettre à jour les 4 webhooks:

1. **dispatch_smur:**
   ```
   https://VOTRE_URL_CLOUD_RUN/api/v1/test/dispatch-smur
   ```

2. **get_patient_history:**
   ```
   https://VOTRE_URL_CLOUD_RUN/api/v1/tools/get_patient_history
   ```

3. **get_pharmacy_on_duty:**
   ```
   https://VOTRE_URL_CLOUD_RUN/api/v1/tools/get_pharmacy_on_duty
   ```

4. **request_human_handoff:**
   ```
   https://VOTRE_URL_CLOUD_RUN/api/v1/tools/request_human_handoff
   ```

---

## ✅ Étape 7: Tests

### 7.1 Health checks

```powershell
$URL = "https://VOTRE_URL_CLOUD_RUN"

# Health check
curl "$URL/health"

# Ready check
curl "$URL/health/ready"
```

### 7.2 Test Twilio

1. Appelez votre numéro Twilio
2. L'agent ElevenLabs devrait répondre
3. Testez un handoff vers opérateur

### 7.3 Vérifier les logs

```powershell
gcloud run logs read samu-ai-staging --region=europe-west4 --limit=50
```

---

## 🧹 Étape 8: Nettoyage

### 8.1 Supprimer les secrets locaux

**⚠️ SEULEMENT après avoir vérifié que tout fonctionne!**

```powershell
Remove-Item -Recurse -Force ..\secrets-backup
```

### 8.2 (Optionnel) Supprimer l'ancien projet

Si vous ne voulez plus utiliser `samu-ai-474822`:

```powershell
gcloud config set project samu-ai-474822
gcloud projects delete samu-ai-474822
```

**⚠️ ATTENTION:** Cette action est **IRRÉVERSIBLE**!

---

## 📊 Récapitulatif

| Étape | Durée estimée | Commande principale |
|-------|---------------|---------------------|
| 1. Export secrets | 2 min | `.\export-secrets.ps1` |
| 2. Setup projet | 15 min | APIs + Service Account |
| 3. Import secrets | 2 min | `.\import-secrets.ps1` |
| 4. Infrastructure | 20 min | Cloud SQL + Redis (optionnel) |
| 5. Déploiement | 15 min | `.\deploy-google-cloud.sh` |
| 6. Config externe | 10 min | Twilio + ElevenLabs |
| 7. Tests | 10 min | Appels test |
| **TOTAL** | **~1h30** | |

---

## 🆘 Troubleshooting

### Erreur: "Secret not found"

```powershell
# Vérifier que les secrets existent
gcloud secrets list
```

### Erreur: "Permission denied"

```powershell
# Vérifier les permissions du service account
gcloud projects get-iam-policy VOTRE_NOUVEAU_PROJECT_ID
```

### Cloud Run ne démarre pas

```powershell
# Vérifier les logs
gcloud run logs read samu-ai-staging --region=europe-west4 --limit=100
```

### Les secrets ne se créent pas

```powershell
# Vérifier que l'API Secret Manager est activée
gcloud services list --enabled | findstr secretmanager
```

---

## 📝 Notes importantes

1. **Secrets sensibles:** Les fichiers dans `secrets-backup/` contiennent des données critiques (API keys, tokens, passwords). Ne les partagez JAMAIS.

2. **Coûts:** Le nouveau projet générera des coûts Google Cloud. Surveillez votre billing.

3. **GitHub Actions:** Pensez à configurer les secrets GitHub pour CI/CD:
   - `GCP_PROJECT_ID`
   - `GCP_SERVICE_ACCOUNT_KEY`

4. **Database migration:** Si vous avez des données importantes en production, utilisez `pg_dump` avant de migrer.

5. **DNS/Domaine:** Si vous utilisez un nom de domaine custom, pensez à mettre à jour les enregistrements DNS.

---

**Bon courage avec la migration! 🚀**

Pour toute question, consultez la documentation complète dans `migration-checklist.md`.
