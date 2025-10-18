#!/bin/bash

# Script pour uploader les secrets vers Google Secret Manager
# Usage: ./scripts/upload-secrets-to-google.sh

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

echo "🔐 Upload des secrets vers Google Secret Manager"
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
# 1. ELEVENLABS_API_KEY
# =============================================================================
if [ -n "${ELEVENLABS_API_KEY}" ]; then
    info "Upload de ELEVENLABS_API_KEY..."

    # Vérifier si le secret existe
    if gcloud secrets describe elevenlabs-api-key --project="${PROJECT_ID}" &>/dev/null; then
        warn "Secret elevenlabs-api-key existe déjà, ajout d'une nouvelle version..."
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets versions add elevenlabs-api-key \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${ELEVENLABS_API_KEY}" | \
            gcloud secrets create elevenlabs-api-key \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}"
    fi

    log "ELEVENLABS_API_KEY uploadé"
else
    warn "ELEVENLABS_API_KEY non trouvé dans .env"
fi

# =============================================================================
# 2. ANTHROPIC_API_KEY
# =============================================================================
if [ -n "${ANTHROPIC_API_KEY}" ]; then
    info "Upload de ANTHROPIC_API_KEY..."

    if gcloud secrets describe anthropic-api-key --project="${PROJECT_ID}" &>/dev/null; then
        warn "Secret anthropic-api-key existe déjà, ajout d'une nouvelle version..."
        echo -n "${ANTHROPIC_API_KEY}" | \
            gcloud secrets versions add anthropic-api-key \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${ANTHROPIC_API_KEY}" | \
            gcloud secrets create anthropic-api-key \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}"
    fi

    log "ANTHROPIC_API_KEY uploadé"
else
    warn "ANTHROPIC_API_KEY non trouvé dans .env"
fi

# =============================================================================
# 3. DATABASE_URL
# =============================================================================
if [ -n "${DATABASE_URL}" ]; then
    info "Upload de DATABASE_URL..."

    if gcloud secrets describe database-url --project="${PROJECT_ID}" &>/dev/null; then
        warn "Secret database-url existe déjà, ajout d'une nouvelle version..."
        echo -n "${DATABASE_URL}" | \
            gcloud secrets versions add database-url \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${DATABASE_URL}" | \
            gcloud secrets create database-url \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}"
    fi

    log "DATABASE_URL uploadé"
else
    warn "DATABASE_URL non trouvé dans .env (normal si pas encore configuré)"
fi

# =============================================================================
# 4. TWILIO (Optionnel)
# =============================================================================
if [ -n "${TWILIO_ACCOUNT_SID}" ]; then
    info "Upload de TWILIO_ACCOUNT_SID..."

    if gcloud secrets describe twilio-account-sid --project="${PROJECT_ID}" &>/dev/null; then
        echo -n "${TWILIO_ACCOUNT_SID}" | \
            gcloud secrets versions add twilio-account-sid \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${TWILIO_ACCOUNT_SID}" | \
            gcloud secrets create twilio-account-sid \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}"
    fi

    log "TWILIO_ACCOUNT_SID uploadé"
fi

if [ -n "${TWILIO_AUTH_TOKEN}" ]; then
    info "Upload de TWILIO_AUTH_TOKEN..."

    if gcloud secrets describe twilio-auth-token --project="${PROJECT_ID}" &>/dev/null; then
        echo -n "${TWILIO_AUTH_TOKEN}" | \
            gcloud secrets versions add twilio-auth-token \
            --data-file=- \
            --project="${PROJECT_ID}"
    else
        echo -n "${TWILIO_AUTH_TOKEN}" | \
            gcloud secrets create twilio-auth-token \
            --data-file=- \
            --replication-policy="automatic" \
            --project="${PROJECT_ID}"
    fi

    log "TWILIO_AUTH_TOKEN uploadé"
fi

# =============================================================================
# RÉSUMÉ
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Secrets uploadés avec succès !"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Liste des secrets créés:"
gcloud secrets list --project="${PROJECT_ID}" --format="table(name,createTime)"
echo ""
echo "🔍 Pour voir un secret:"
echo "   gcloud secrets versions access latest --secret=elevenlabs-api-key --project=${PROJECT_ID}"
echo ""
echo "🗑️  Pour supprimer un secret:"
echo "   gcloud secrets delete SECRET_NAME --project=${PROJECT_ID}"
echo ""
echo "═══════════════════════════════════════════════════════"
