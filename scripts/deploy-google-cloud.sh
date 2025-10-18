#!/bin/bash

# Script de déploiement Google Cloud pour SAMU AI
# Usage: ./scripts/deploy-google-cloud.sh [environment]

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-samu-ai-474822}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE_NAME="samu-backend"
ENVIRONMENT="${1:-production}"

# Couleurs pour logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}✓${NC} $1"
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Vérifier les prérequis
info "Vérification des prérequis..."

if ! command -v gcloud &> /dev/null; then
  error "gcloud CLI n'est pas installé. Installez-le depuis https://cloud.google.com/sdk/docs/install"
fi

if ! command -v docker &> /dev/null; then
  error "Docker n'est pas installé. Installez-le depuis https://docs.docker.com/get-docker/"
fi

log "Prérequis OK"

# Configurer le projet
info "Configuration du projet Google Cloud: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

# Activer les APIs nécessaires
info "Activation des APIs Google Cloud..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

log "APIs activées"

# Build de l'application TypeScript
info "Build de l'application..."
npm run build
log "Build terminé"

# Build de l'image Docker avec Cloud Build (plus rapide que local)
info "Build de l'image Docker via Cloud Build..."
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
LATEST_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${ENVIRONMENT}-latest"

gcloud builds submit \
  --tag="${IMAGE_TAG}" \
  --tag="${LATEST_TAG}" \
  --timeout=15m \
  --file=Dockerfile.production \
  --project="${PROJECT_ID}"

log "Image Docker buildée: ${IMAGE_TAG}"

# Déployer sur Cloud Run
info "Déploiement sur Cloud Run..."

# Récupérer les secrets depuis Secret Manager
DATABASE_URL_SECRET="projects/${PROJECT_ID}/secrets/database-url/versions/latest"
ELEVENLABS_KEY_SECRET="projects/${PROJECT_ID}/secrets/elevenlabs-api-key/versions/latest"
ANTHROPIC_KEY_SECRET="projects/${PROJECT_ID}/secrets/anthropic-api-key/versions/latest"

gcloud run deploy "${SERVICE_NAME}" \
  --image="${LATEST_TAG}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=2 \
  --timeout=300s \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --port=8080 \
  --set-env-vars="NODE_ENV=${ENVIRONMENT}" \
  --set-env-vars="LOG_LEVEL=info" \
  --set-secrets="DATABASE_URL=${DATABASE_URL_SECRET}:latest" \
  --set-secrets="ELEVENLABS_API_KEY=${ELEVENLABS_KEY_SECRET}:latest" \
  --set-secrets="ANTHROPIC_API_KEY=${ANTHROPIC_KEY_SECRET}:latest" \
  --project="${PROJECT_ID}"

log "Déploiement Cloud Run terminé"

# Récupérer l'URL du service
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --format='value(status.url)' \
  --project="${PROJECT_ID}")

log "Service déployé avec succès!"

# Afficher les informations de déploiement
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  🚀 SAMU AI Backend déployé avec succès!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📍 URL du service:"
echo "   ${SERVICE_URL}"
echo ""
echo "🔍 Endpoints disponibles:"
echo "   Health Check:    ${SERVICE_URL}/health"
echo "   API Docs:        ${SERVICE_URL}/docs"
echo "   Dispatch SMUR:   ${SERVICE_URL}/api/v1/test/dispatch-smur"
echo "   Conversations:   ${SERVICE_URL}/api/v1/test/conversations"
echo ""
echo "📊 Monitoring:"
echo "   Logs:     gcloud run logs tail ${SERVICE_NAME} --region=${REGION}"
echo "   Metrics:  https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics"
echo ""
echo "🔧 Configuration ElevenLabs:"
echo "   Mettez à jour les Client Tools URLs avec:"
echo "   ${SERVICE_URL}/api/v1/test/dispatch-smur"
echo "   ${SERVICE_URL}/api/v1/test/analyze-abcd"
echo ""
echo "═══════════════════════════════════════════════════════"

# Test du health check
info "Test du health check..."
if curl -f -s "${SERVICE_URL}/health" > /dev/null; then
  log "Health check OK ✓"
else
  warn "Health check échoué - vérifiez les logs"
fi

# Afficher les logs récents
info "Derniers logs du service:"
gcloud run logs tail "${SERVICE_NAME}" \
  --region="${REGION}" \
  --limit=10 \
  --project="${PROJECT_ID}"
