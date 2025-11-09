# Migration vers Nouveau Projet Google Cloud

## Prérequis

- [ ] Nouveau compte Google créé
- [ ] Nouveau projet Google Cloud créé
- [ ] gcloud CLI installé et configuré
- [ ] Billing activé sur le nouveau projet

## Étape 1: Export depuis l'ancien projet

### 1.1 Se connecter à l'ancien projet

```bash
gcloud auth login
gcloud config set project samu-ai-474822
```

### 1.2 Exporter les secrets

```bash
cd scripts
bash export-secrets.sh ../secrets-backup
```

**Important**: Ne commitez JAMAIS le dossier `secrets-backup/` dans git!

### 1.3 Sauvegarder la base de données (si Cloud SQL)

Si vous utilisez Cloud SQL:

```bash
gcloud sql export sql INSTANCE_NAME gs://BUCKET_NAME/backup.sql \
  --database=samu_triage
```

Si PostgreSQL local, utilisez:

```bash
pg_dump -h localhost -U postgres samu_triage > backup.sql
```

### 1.4 Exporter les fichiers Cloud Storage (si utilisé)

```bash
gsutil -m cp -r gs://VOTRE_BUCKET ./storage-backup/
```

---

## Étape 2: Setup du nouveau projet

### 2.1 Se connecter au nouveau compte

```bash
gcloud auth login
# Sélectionnez votre nouveau compte Google
```

### 2.2 Créer et configurer le nouveau projet

```bash
# Créer le projet (si pas déjà fait)
gcloud projects create NOUVEAU_PROJECT_ID --name="SAMU AI Triage"

# Configurer gcloud
gcloud config set project NOUVEAU_PROJECT_ID

# Activer les APIs nécessaires
gcloud services enable \
  secretmanager.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 2.3 Créer le service account

```bash
# Créer le service account
gcloud iam service-accounts create samu-ai-service \
  --display-name="SAMU AI Service Account"

# Donner les permissions nécessaires
gcloud projects add-iam-policy-binding NOUVEAU_PROJECT_ID \
  --member="serviceAccount:samu-ai-service@NOUVEAU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding NOUVEAU_PROJECT_ID \
  --member="serviceAccount:samu-ai-service@NOUVEAU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding NOUVEAU_PROJECT_ID \
  --member="serviceAccount:samu-ai-service@NOUVEAU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### 2.4 Importer les secrets

```bash
cd scripts
bash import-secrets.sh ../secrets-backup NOUVEAU_PROJECT_ID
```

### 2.5 Vérifier les secrets importés

```bash
gcloud secrets list
```

---

## Étape 3: Infrastructure

### 3.1 Créer Cloud SQL PostgreSQL (si nécessaire)

```bash
gcloud sql instances create samu-ai-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west4 \
  --storage-type=SSD \
  --storage-size=10GB \
  --database-flags=max_connections=100

# Créer la base de données
gcloud sql databases create samu_triage --instance=samu-ai-db

# Créer un utilisateur
gcloud sql users create samu_user \
  --instance=samu-ai-db \
  --password=VOTRE_PASSWORD_SECURE
```

### 3.2 Créer Redis (Cloud Memorystore)

```bash
gcloud redis instances create samu-ai-redis \
  --size=1 \
  --region=europe-west4 \
  --tier=basic
```

### 3.3 Créer Cloud Storage bucket (si nécessaire)

```bash
gsutil mb -l europe-west4 gs://NOUVEAU_PROJECT_ID-audio-recordings/
```

---

## Étape 4: Déploiement

### 4.1 Mettre à jour le code

Dans votre nouveau repo forké, mettre à jour:

**`.github/workflows/deploy-staging.yml`**:
- Remplacer `samu-ai-474822` par `NOUVEAU_PROJECT_ID`
- Mettre à jour le service account email

**`.github/workflows/deploy-production.yml`**:
- Même chose

**`scripts/deploy-google-cloud.sh`**:
- Vérifier le PROJECT_ID

### 4.2 Déployer sur Cloud Run

```bash
# Depuis la racine du projet
./scripts/deploy-google-cloud.sh staging

# Ou production
./scripts/deploy-google-cloud.sh production
```

### 4.3 Configurer les variables d'environnement Cloud Run

Le script de déploiement devrait déjà le faire, mais vérifiez:

```bash
gcloud run services update samu-ai-staging \
  --region=europe-west4 \
  --set-env-vars="NODE_ENV=staging" \
  --set-secrets="DATABASE_URL=staging-database-url:latest,REDIS_URL=staging-redis-url:latest"
```

---

## Étape 5: Configuration Twilio

### 5.1 Mettre à jour les webhooks Twilio

Dans Twilio Console → Phone Numbers → Votre numéro:

**Incoming Voice**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/twilio/inbound
```

**Status Callback**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/twilio/post-call-webhook
```

---

## Étape 6: Configuration ElevenLabs

### 6.1 Mettre à jour les webhooks des Client Tools

Dans ElevenLabs Dashboard → Agent → Tools:

**dispatch_smur**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/test/dispatch-smur
```

**get_patient_history**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/tools/get_patient_history
```

**get_pharmacy_on_duty**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/tools/get_pharmacy_on_duty
```

**request_human_handoff**:
```
https://NOUVELLE_URL_CLOUD_RUN/api/v1/tools/request_human_handoff
```

---

## Étape 7: Tests

### 7.1 Vérifier les health checks

```bash
curl https://NOUVELLE_URL/health
curl https://NOUVELLE_URL/health/ready
```

### 7.2 Tester un appel Twilio

1. Appeler votre numéro Twilio
2. Vérifier que l'agent ElevenLabs répond
3. Tester le handoff vers opérateur

### 7.3 Vérifier les logs

```bash
gcloud run logs read samu-ai-staging --region=europe-west4 --limit=50
```

---

## Étape 8: Nettoyage

### 8.1 Supprimer les fichiers de backup locaux

```bash
# ⚠️ SEULEMENT après avoir vérifié que tout fonctionne!
rm -rf secrets-backup/
rm -f backup.sql
```

### 8.2 (Optionnel) Supprimer l'ancien projet

Si vous ne voulez plus utiliser l'ancien projet:

```bash
gcloud projects delete samu-ai-474822
```

**⚠️ ATTENTION**: Cela supprime TOUT de manière IRRÉVERSIBLE!

---

## Checklist Finale

- [ ] Secrets importés et vérifiés
- [ ] Base de données migrée (si Cloud SQL)
- [ ] Cloud Run déployé (staging)
- [ ] Cloud Run déployé (production)
- [ ] Twilio webhooks mis à jour
- [ ] ElevenLabs tools webhooks mis à jour
- [ ] Tests d'appels Twilio réussis
- [ ] Tests de handoff opérateur réussis
- [ ] Fichiers de backup supprimés
- [ ] Ancien projet désactivé (optionnel)

---

## Temps Estimé

- Export secrets: **5 minutes**
- Setup nouveau projet: **15 minutes**
- Import secrets: **5 minutes**
- Infrastructure (Cloud SQL + Redis): **20 minutes**
- Déploiement Cloud Run: **10 minutes**
- Configuration Twilio/ElevenLabs: **10 minutes**
- Tests: **15 minutes**

**TOTAL: ~1h30**

---

## En Cas de Problème

### Erreur: "Secret not found"

Vérifiez que les secrets sont bien créés:
```bash
gcloud secrets list
```

### Erreur: "Permission denied"

Vérifiez les permissions du service account:
```bash
gcloud projects get-iam-policy NOUVEAU_PROJECT_ID
```

### Cloud Run ne démarre pas

Vérifiez les logs:
```bash
gcloud run logs read samu-ai-staging --region=europe-west4
```

### Base de données inaccessible

Vérifiez que Cloud SQL autorise les connexions Cloud Run:
```bash
gcloud sql instances describe samu-ai-db
```

---

**Bonne migration! 🚀**
