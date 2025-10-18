#!/bin/bash

# Script pour créer les secrets staging à partir des secrets dev
# À exécuter dans Google Cloud Shell
# Usage: bash scripts/create-staging-secrets.sh

set -e

PROJECT_ID="samu-ai-474822"

echo "🔐 Création des secrets STAGING"
echo "   Project: ${PROJECT_ID}"
echo ""

# Activer Secret Manager API
echo "📦 Activation de Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project="${PROJECT_ID}" --quiet

echo ""
echo "📥 Récupération des secrets DEV existants..."

# Récupérer les secrets dev
DEV_DATABASE_URL=$(gcloud secrets versions access latest --secret=dev-database-url --project="${PROJECT_ID}" 2>/dev/null || echo "")
DEV_ELEVENLABS_API_KEY=$(gcloud secrets versions access latest --secret=dev-elevenlabs-api-key --project="${PROJECT_ID}" 2>/dev/null || echo "")
DEV_ELEVENLABS_AGENT_ID=$(gcloud secrets versions access latest --secret=dev-elevenlabs-agent-id --project="${PROJECT_ID}" 2>/dev/null || echo "")
DEV_GOOGLE_API_KEY=$(gcloud secrets versions access latest --secret=dev-google-api-key --project="${PROJECT_ID}" 2>/dev/null || echo "")

echo "✓ Secrets DEV récupérés"

echo ""
echo "🔑 Génération de nouveaux secrets pour STAGING..."

# Générer nouveau JWT secret (256 bits en base64)
STAGING_JWT_SECRET=$(openssl rand -base64 32)
echo "✓ JWT secret généré"

# Générer nouveau encryption key (256 bits en base64)
STAGING_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "✓ Encryption key générée"

echo ""
echo "☁️ Upload des secrets STAGING vers Google Secret Manager..."

# Fonction helper pour créer ou mettre à jour un secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2

    if [ -z "$secret_value" ]; then
        echo "⚠️  $secret_name: valeur vide, ignoré"
        return
    fi

    if gcloud secrets describe "$secret_name" --project="${PROJECT_ID}" &>/dev/null; then
        echo -n "${secret_value}" | \
            gcloud secrets versions add "$secret_name" \
            --data-file=- \
            --project="${PROJECT_ID}" \
            --quiet
        echo "✓ $secret_name mis à jour"
    else
        echo -n "${secret_value}" | \
            gcloud secrets create "$secret_name" \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}" \
            --quiet
        echo "✓ $secret_name créé"
    fi
}

# Upload tous les secrets staging
create_or_update_secret "staging-database-url" "$DEV_DATABASE_URL"
create_or_update_secret "staging-elevenlabs-api-key" "$DEV_ELEVENLABS_API_KEY"
create_or_update_secret "staging-elevenlabs-agent-id" "$DEV_ELEVENLABS_AGENT_ID"
create_or_update_secret "staging-google-api-key" "$DEV_GOOGLE_API_KEY"
create_or_update_secret "staging-jwt-secret" "$STAGING_JWT_SECRET"
create_or_update_secret "staging-encryption-key" "$STAGING_ENCRYPTION_KEY"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Secrets STAGING créés avec succès !"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Secrets STAGING créés:"
gcloud secrets list --filter="name:staging-*" --project="${PROJECT_ID}" --format="table(name,createTime)"
echo ""
echo "🔍 Pour voir un secret:"
echo "   gcloud secrets versions access latest --secret=staging-database-url --project=${PROJECT_ID}"
echo ""
echo "═══════════════════════════════════════════════════════"
