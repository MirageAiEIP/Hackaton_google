#!/bin/bash

# Script de nettoyage complet du projet SAMU AI
# Supprime tous les fichiers inutilisés avant déploiement

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

echo "🧹 Nettoyage du projet SAMU AI..."
echo ""

# =============================================================================
# 1. SUPPRIMER LES FICHIERS .MD INUTILES
# =============================================================================
info "Suppression des fichiers .md inutiles..."

# Docs obsolètes - anciennes architectures
rm -f docs/AGENT_WORKFLOW.md
rm -f docs/ARCHITECTURE.md
rm -f docs/ARCHITECTURE_FAST.md
rm -f docs/ARCHITECTURE_FLOW.md
rm -f docs/ARCHITECTURE_REVIEW.md
rm -f docs/DATABASE.md
rm -f docs/ELEVENLABS_CLIENT_TOOLS.md
rm -f docs/REALTIME_CALL_ARCHITECTURE.md
rm -f docs/TRIAGE_AGENT_ARCHITECTURE.md

# Services supprimés (sentiment, whisper)
rm -f docs/SENTIMENT_ANALYSIS.md
rm -f docs/SENTIMENT_API_USAGE.md

# Fichiers root à supprimer
rm -f ELEVENLABS_AGENTS_PLATFORM.md
rm -f ELEVENLABS_APIS.md
rm -f FLUX_ANALYSE.md
rm -f SECRETS_ARCHITECTURE.md
rm -f TESTING.md

log "Fichiers .md obsolètes supprimés"

# =============================================================================
# 2. SUPPRIMER LES SERVICES INUTILISÉS
# =============================================================================
info "Suppression des services inutilisés..."

# Services d'analyse sentiment/audio supprimés
rm -f src/services/analysis/audio-analysis.service.ts
rm -f src/services/analysis/gemini.service.ts
rm -f src/services/analysis/hybrid-sentiment.service.ts
rm -f src/services/analysis/sentiment-analysis.service.ts
rm -f src/services/analysis/whisper.service.ts
rm -f src/services/analysis/audio-emotion.service.ts

# Supprimer le dossier analysis s'il est vide
rmdir src/services/analysis 2>/dev/null || true

# Routes supprimées
rm -f src/api/routes/sentiment.routes.ts

# Agents supprimés (old triage)
rm -f src/agents/triage-agent.ts

log "Services inutilisés supprimés"

# =============================================================================
# 3. SUPPRIMER LES TESTS INUTILISÉS
# =============================================================================
info "Suppression des tests inutilisés..."

# Tests d'intégration pour services supprimés
rm -f src/services/__tests__/sentiment-analysis.integration.test.ts
rm -f src/services/__tests__/whisper.integration.test.ts
rm -f src/services/__tests__/audio-analysis.integration.test.ts
rm -f src/services/__tests__/hybrid-sentiment.integration.test.ts

# Tests secrets/calibration
rm -f src/config/__tests__/secrets.test.ts
rm -f src/services/__tests__/secrets.test.ts
rm -f src/services/__tests__/calibration.test.ts

log "Tests obsolètes supprimés"

# =============================================================================
# 4. SUPPRIMER LES SCRIPTS DE TEST INUTILISÉS
# =============================================================================
info "Suppression des scripts de test..."

rm -f scripts/test-agent.ts
rm -f scripts/test-conversational-agent.ts
rm -f scripts/check-agent.ts
rm -f scripts/test-calibration.ts

log "Scripts de test supprimés"

# =============================================================================
# 5. NETTOYER LES FICHIERS DE CREDENTIALS LOCAUX
# =============================================================================
info "Nettoyage des credentials locaux..."

# Supprimer les credentials Google Cloud locaux (seront sur Secret Manager)
rm -f credentials.json
rm -f service-account.json
rm -f google-credentials.json

# Garder seulement .env.example
rm -f .env.local
rm -f .env.development
rm -f .env.test

log "Credentials locaux nettoyés"

# =============================================================================
# 6. SUPPRIMER LES FICHIERS BUILD/CACHE
# =============================================================================
info "Suppression des fichiers build/cache..."

rm -rf dist/
rm -rf build/
rm -rf .next/
rm -rf coverage/
rm -rf .nyc_output/
rm -rf .turbo/
rm -f *.log
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*
rm -f .DS_Store
rm -f Thumbs.db

log "Fichiers build/cache supprimés"

# =============================================================================
# 7. SUPPRIMER LES FICHIERS TEMPORAIRES
# =============================================================================
info "Suppression des fichiers temporaires..."

rm -rf tmp/
rm -rf temp/
rm -f nul
rm -f test_audio*.mp3

log "Fichiers temporaires supprimés"

# =============================================================================
# 8. NETTOYER node_modules (optionnel)
# =============================================================================
read -p "Voulez-vous nettoyer node_modules et réinstaller les dépendances ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Suppression de node_modules..."
    rm -rf node_modules/
    log "node_modules supprimé"

    info "Réinstallation des dépendances..."
    npm ci --legacy-peer-deps
    log "Dépendances réinstallées"
fi

# =============================================================================
# 9. RÉSUMÉ
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✨ Nettoyage terminé !"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📁 Fichiers conservés:"
echo "   ✓ README.md"
echo "   ✓ CLAUDE.md"
echo "   ✓ docs/CONVERSATION_TRACKING.md"
echo "   ✓ docs/DEPLOIEMENT_GOOGLE_CLOUD.md"
echo "   ✓ prompts/*.md"
echo ""
echo "🗑️  Fichiers supprimés:"
echo "   ✗ 14 fichiers .md obsolètes"
echo "   ✗ 6 services inutilisés"
echo "   ✗ Tous les tests obsolètes"
echo "   ✗ Scripts de test"
echo "   ✗ Credentials locaux"
echo ""
echo "📊 Espace disque libéré:"
du -sh . 2>/dev/null || echo "   (calculer avec 'du -sh .')"
echo ""
echo "═══════════════════════════════════════════════════════"
