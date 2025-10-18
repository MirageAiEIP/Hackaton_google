#!/bin/bash

# Analyse des dépendances à supprimer

echo "🔍 ANALYSE DES DÉPENDANCES"
echo ""

# ============================================================================
# ✅ DEFINITVEMENT À SUPPRIMER (services supprimés)
# ============================================================================
echo "✅ À SUPPRIMER (services supprimés):"
echo ""
cat <<'EOF'
Dependencies:
  @google-cloud/speech              # Whisper service supprimé
  @google/genai                     # Gemini service supprimé
  @google/generative-ai             # Gemini (doublon)
  @huggingface/inference            # Jamais utilisé
  @ricky0123/vad-node               # VAD service pas utilisé
  openai                            # Whisper/OpenAI supprimé
  @anthropic-ai/sdk                 # Claude direct pas utilisé (on utilise Mastra)

DevDependencies:
  @types/fluent-ffmpeg              # ffmpeg pas utilisé
  ffmpeg-static                     # ffmpeg pas utilisé
  fluent-ffmpeg                     # ffmpeg pas utilisé
EOF

echo ""
echo "⚠️  À VÉRIFIER (peut-être utilisé dans frontend HTML):"
echo ""
cat <<'EOF'
Dependencies:
  @elevenlabs/client                # SDK ElevenLabs (frontend HTML?)
  @elevenlabs/elevenlabs-js         # Old SDK (doublon?)
  @mastra/core                      # Framework Mastra (backend?)
  fastify-plugin                    # Plugins Fastify
  uuid                              # IDs uniques
  zod-to-json-schema                # Schema validation

DevDependencies:
  @types/uuid                       # Types pour uuid
  @vitest/coverage-v8               # Coverage tests
  eslint-plugin-import              # ESLint
EOF

echo ""
echo "📊 COMMANDES POUR SUPPRIMER:"
echo ""
echo "# Supprimer les dépendances inutilisées:"
cat <<'EOF'
npm uninstall \
  @google-cloud/speech \
  @google/genai \
  @google/generative-ai \
  @huggingface/inference \
  @ricky0123/vad-node \
  openai \
  @anthropic-ai/sdk

npm uninstall --save-dev \
  @types/fluent-ffmpeg \
  ffmpeg-static \
  fluent-ffmpeg
EOF

echo ""
