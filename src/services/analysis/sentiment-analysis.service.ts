import Anthropic from '@anthropic-ai/sdk';

import { config } from '@/config';
import { logger } from '@/utils/logger';
import type {
  ClaudeSemanticAnalysis,
  SentimentType,
  TextAnalysis,
  UrgencyMarker,
} from '@/types/sentiment.types';

/**
 * Service for analyzing sentiment and stress from text transcripts
 *
 * Uses both regex-based keyword detection and Claude semantic analysis
 * for comprehensive text understanding
 */
export class SentimentAnalysisService {
  private readonly claudeClient: Anthropic;

  constructor() {
    this.claudeClient = new Anthropic({
      apiKey: config.ai.anthropicApiKey,
    });
  }

  /**
   * Analyze text transcript for sentiment and stress indicators
   *
   * @param transcript - Text from speech-to-text or user input
   * @returns Complete text analysis with stress level and markers
   */
  async analyzeText(transcript: string): Promise<TextAnalysis> {
    logger.info('Starting text sentiment analysis', {
      transcriptLength: transcript.length,
    });

    try {
      // 1. Fast keyword detection (no API call needed)
      const urgencyMarkers = this.detectUrgencyMarkers(transcript);

      // 2. Deep semantic analysis with Claude
      const semanticAnalysis = await this.analyzeWithClaude(transcript);

      // 3. Calculate final stress level
      const stressLevel = this.calculateStressLevel(urgencyMarkers, semanticAnalysis);

      const result: TextAnalysis = {
        sentiment: semanticAnalysis.sentiment,
        stressLevel,
        urgencyMarkers,
        painLanguage: semanticAnalysis.painIntensity,
        coherence: semanticAnalysis.coherence,
        confidence: semanticAnalysis.confidence,
      };

      logger.info('Text sentiment analysis completed', {
        sentiment: result.sentiment,
        stressLevel: result.stressLevel,
        markersCount: urgencyMarkers.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to analyze text sentiment', error as Error);
      throw new Error('Text sentiment analysis failed');
    }
  }

  /**
   * Detect urgency markers using regex patterns
   * Fast and doesn't require API calls
   *
   * @param text - Input text
   * @returns List of detected urgency markers
   */
  private detectUrgencyMarkers(text: string): UrgencyMarker[] {
    const markers: UrgencyMarker[] = [];
    const lower = text.toLowerCase();

    // Pain intensifiers
    if (/très|vraiment|extrêmement|insupportable|atroce|horrible/i.test(text)) {
      markers.push('SEVERE_PAIN_LANGUAGE');
    }

    // Temporal urgency
    if (/vite|immédiatement|maintenant|urgent|aidez[-\s]moi|au secours/i.test(text)) {
      markers.push('TEMPORAL_URGENCY');
    }

    // Death anxiety
    if (/mourir|je vais mourir|c'est la fin|je crois que|plus longtemps/i.test(text)) {
      markers.push('DEATH_ANXIETY');
    }

    // Repetitions (panic indicator)
    const words = lower.split(/\s+/);
    const consecutiveRepeats = this.findConsecutiveRepeats(words);
    if (consecutiveRepeats > 2) {
      markers.push('REPETITIONS');
    }

    // Textual hesitations/pauses
    if (/\.{2,}|…/g.test(text)) {
      const hesitations = (text.match(/\.{2,}|…/g) || []).length;
      if (hesitations >= 3) {
        markers.push('HESITATIONS');
      }
    }

    // Excessive uppercase (shouting)
    const upperCaseCount = (text.match(/[A-Z]/g) || []).length;
    const upperCaseRatio = upperCaseCount / text.length;
    if (upperCaseRatio > 0.3 && text.length > 10) {
      markers.push('SHOUTING');
    }

    return markers;
  }

  /**
   * Find consecutive word repetitions (e.g., "help help help")
   *
   * @param words - Array of words
   * @returns Maximum consecutive repeat count
   */
  private findConsecutiveRepeats(words: string[]): number {
    let maxRepeats = 0;
    let currentRepeats = 1;

    for (let i = 1; i < words.length; i++) {
      const currentWord = words[i];
      const previousWord = words[i - 1];

      if (currentWord && previousWord && currentWord === previousWord && currentWord.length > 2) {
        currentRepeats++;
        maxRepeats = Math.max(maxRepeats, currentRepeats);
      } else {
        currentRepeats = 1;
      }
    }

    return maxRepeats;
  }

  /**
   * Analyze text semantically using Claude
   *
   * @param transcript - Text to analyze
   * @returns Semantic analysis from Claude
   */
  private async analyzeWithClaude(transcript: string): Promise<ClaudeSemanticAnalysis> {
    const prompt = `Tu es un expert en analyse de sentiment pour les appels d'urgence médicale.

Analyse ce transcript d'appel au SAMU 15:

"""
${transcript}
"""

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de texte avant/après) avec cette structure exacte:
{
  "sentiment": "CALM" | "ANXIOUS" | "PANICKED" | "CONFUSED" | "IN_PAIN",
  "painIntensity": 0-100,
  "coherence": 0-100,
  "confidence": 0-1,
  "reasoning": "Explication en 1-2 phrases"
}

Critères:
- CALM: Parle normalement, pas de détresse apparente
- ANXIOUS: Inquiet mais reste cohérent
- PANICKED: Répétitions, langage urgent, stress évident
- CONFUSED: Incohérences, contradictions, difficulté à s'exprimer
- IN_PAIN: Exprime explicitement une douleur intense

painIntensity (0-100):
- 0-30: Pas de douleur ou douleur légère mentionnée
- 31-60: Douleur modérée
- 61-100: Douleur sévère/insupportable

coherence (0-100):
- 100: Réponses claires, logiques, cohérentes
- 50: Quelques hésitations mais compréhensible
- 0: Très confus, incohérent, contradictoire

confidence (0-1):
- Ta confiance dans cette analyse basée sur la longueur et clarté du transcript`;

    try {
      const response = await this.claudeClient.messages.create({
        model: config.ai.model,
        max_tokens: 500,
        temperature: 0.3, // Low temperature for consistent analysis
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (!content) {
        throw new Error('Empty response from Claude');
      }

      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const text = content.text.trim();
      // Remove markdown code blocks if present
      const jsonText = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const analysis = JSON.parse(jsonText) as ClaudeSemanticAnalysis;

      // Validate response
      this.validateClaudeResponse(analysis);

      return analysis;
    } catch (error) {
      logger.error('Claude sentiment analysis failed', error as Error, {
        transcriptPreview: transcript.substring(0, 100),
      });

      // Return safe default
      return {
        sentiment: 'ANXIOUS',
        painIntensity: 50,
        coherence: 70,
        confidence: 0.3,
        reasoning: 'Analysis failed, using default values',
      };
    }
  }

  /**
   * Validate Claude response has required fields
   */
  private validateClaudeResponse(analysis: ClaudeSemanticAnalysis): void {
    const validSentiments: SentimentType[] = ['CALM', 'ANXIOUS', 'PANICKED', 'CONFUSED', 'IN_PAIN'];

    if (!validSentiments.includes(analysis.sentiment)) {
      throw new Error(`Invalid sentiment: ${analysis.sentiment}`);
    }

    if (
      typeof analysis.painIntensity !== 'number' ||
      analysis.painIntensity < 0 ||
      analysis.painIntensity > 100
    ) {
      throw new Error(`Invalid painIntensity: ${analysis.painIntensity}`);
    }

    if (
      typeof analysis.coherence !== 'number' ||
      analysis.coherence < 0 ||
      analysis.coherence > 100
    ) {
      throw new Error(`Invalid coherence: ${analysis.coherence}`);
    }

    if (
      typeof analysis.confidence !== 'number' ||
      analysis.confidence < 0 ||
      analysis.confidence > 1
    ) {
      throw new Error(`Invalid confidence: ${analysis.confidence}`);
    }
  }

  /**
   * Calculate final stress level from markers and semantic analysis
   *
   * @param markers - Detected urgency markers
   * @param semantic - Claude semantic analysis
   * @returns Stress level 0-100
   */
  private calculateStressLevel(markers: UrgencyMarker[], semantic: ClaudeSemanticAnalysis): number {
    // Base stress from sentiment
    const sentimentStress: Record<SentimentType, number> = {
      CALM: 10,
      ANXIOUS: 40,
      PANICKED: 80,
      CONFUSED: 60,
      IN_PAIN: 70,
    };

    let stress = sentimentStress[semantic.sentiment];

    // Add bonus for each urgency marker
    stress += markers.length * 5;

    // Add pain intensity contribution
    stress += semantic.painIntensity * 0.2;

    // Penalize low coherence (confusion = stress)
    if (semantic.coherence < 50) {
      stress += (50 - semantic.coherence) * 0.5;
    }

    // Cap at 100
    return Math.min(100, Math.round(stress));
  }
}

// Export singleton instance
export const sentimentAnalysisService = new SentimentAnalysisService();
