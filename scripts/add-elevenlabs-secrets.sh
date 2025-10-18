#!/bin/bash

# Script pour ajouter les secrets ElevenLabs manquants à Google Secret Manager
# Usage: ./scripts/add-elevenlabs-secrets.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

PROJECT_ID="${GCP_PROJECT_ID:-samu-ai-474822}"

echo "🔐 Ajout des secrets ElevenLabs à Google Secret Manager"
echo "   Project: ${PROJECT_ID}"
echo ""

# Vérifier que gcloud est installé
if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI n'est pas installé. Installez-le depuis https://cloud.google.com/sdk/docs/install"
fi

# Vérifier que .env existe
if [ ! -f .env ]; then
    error "Fichier .env non trouvé. Créez-le à partir de .env.example"
fi

# Charger les variables d'environnement
set -a
source .env
set +a

info "Configuration du projet GCP..."
gcloud config set project "${PROJECT_ID}"

# Activer Secret Manager API
info "Activation de Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project="${PROJECT_ID}" --quiet

# =============================================================================
# DEV-ELEVENLABS-API-KEY
# =============================================================================
if [ -n "${ELEVENLABS_API_KEY}" ]; then
    info "Upload de dev-elevenlabs-api-key..."

    if gcloud secrets describe dev-elevenlabs-api-key --project="${PROJECT_ID}" &>/dev/null; then
        warn "Secret dev-elevenlabs-api-key existe déjà, ajout d'une nouvelle version..."
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets versions add dev-elevenlabs-api-key \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets create dev-elevenlabs-api-key \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="environment=dev,managed=true" \
            --project="${PROJECT_ID}"
    fi

    log "dev-elevenlabs-api-key uploadé"
else
    error "ELEVENLABS_API_KEY non trouvé dans .env"
fi

# =============================================================================
# PROD-ELEVENLABS-API-KEY
# =============================================================================
if [ -n "${ELEVENLABS_API_KEY}" ]; then
    info "Upload de prod-elevenlabs-api-key..."

    if gcloud secrets describe prod-elevenlabs-api-key --project="${PROJECT_ID}" &>/dev/null; then
        warn "Secret prod-elevenlabs-api-key existe déjà, ajout d'une nouvelle version..."
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets versions add prod-elevenlabs-api-key \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets create prod-elevenlabs-api-key \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="environment=prod,managed=true" \
            --project="${PROJECT_ID}"
    fi

    log "prod-elevenlabs-api-key uploadé"
fi

# =============================================================================
# RÉSUMÉ
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Secrets ElevenLabs uploadés avec succès !"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Liste de tous les secrets:"
gcloud secrets list --project="${PROJECT_ID}" --format="table(name,createTime,labels)"
echo ""
echo "🔍 Pour voir un secret:"
echo "   gcloud secrets versions access latest --secret=dev-elevenlabs-api-key --project=${PROJECT_ID}"
echo ""
echo "🗑️  Pour supprimer un secret:"
echo "   gcloud secrets delete SECRET_NAME --project=${PROJECT_ID}"
echo ""
echo "═══════════════════════════════════════════════════════"
