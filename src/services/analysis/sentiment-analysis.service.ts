import { logger } from '@/utils/logger';
import type { SemanticAnalysis, TextAnalysis, UrgencyMarker } from '@/types/sentiment.types';
import { geminiService } from './gemini.service';

/**
 * Service for analyzing sentiment and stress from text transcripts
 *
 * Uses both regex-based keyword detection and Google Gemini semantic analysis
 * for comprehensive text understanding
 */
export class SentimentAnalysisService {
  constructor() {
    // No initialization needed - using singleton geminiService
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

      // 2. Deep semantic analysis with Google Gemini
      const semanticAnalysis = await geminiService.analyzeText(transcript);

      // 3. Calculate final stress level
      const stressLevel = this.calculateStressLevel(urgencyMarkers, semanticAnalysis, transcript);

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
   * Calculate final stress level from markers and semantic analysis
   *
   * @param markers - Detected urgency markers
   * @param semantic - Gemini semantic analysis
   * @returns Stress level 0-100
   */
  private calculateStressLevel(
    markers: UrgencyMarker[],
    semantic: SemanticAnalysis,
    transcript: string
  ): number {
    // Start with Gemini's painIntensity as the PRIMARY score
    let stress = semantic.painIntensity;

    // Add bonus for urgency markers
    stress += markers.length * 3;

    // Adjust based on sentiment
    if (semantic.sentiment === 'PANICKED') {
      stress = Math.max(stress, 85); // Panic = always urgent
    } else if (semantic.sentiment === 'CONFUSED') {
      stress = Math.max(stress, 70); // Confusion = serious
    }

    // Penalize low coherence (confusion = stress)
    if (semantic.coherence < 50) {
      stress += (50 - semantic.coherence) * 0.3;
    }

    // CRITICAL: Force minimum scores for life-threatening symptoms

    // AVC signs (stroke)
    if (
      /bouche.*tordu|bras.*paralys|bras.*bouge.*plus|parle.*bizarre.*bras|face.*drooping/i.test(
        transcript
      )
    ) {
      stress = Math.max(stress, 88);
      logger.warn('AVC signs detected - forcing high urgency score', { originalScore: stress });
    }

    // Chest pain
    if (
      /douleur.*poitrine|douleur.*thoracique|mal.*poitrine|oppression.*poitrine|serrement.*poitrine/i.test(
        transcript
      )
    ) {
      stress = Math.max(stress, 78);
      logger.warn('Chest pain detected - forcing high urgency score', { originalScore: stress });
    }

    // Severe respiratory distress
    if (
      /(arrive.*plus|ne.*plus|peux.*plus).*respirer|asphyxie|étouffe|suffoque/i.test(transcript)
    ) {
      stress = Math.max(stress, 85);
    }

    // NON-URGENT: Force MAXIMUM scores for info requests
    if (
      /renseignement|pharmacie.*garde|médecin.*garde|je.*voudrais.*savoir|j'aurais.*voulu/i.test(
        transcript
      )
    ) {
      stress = Math.min(stress, 22);
      logger.info('Information request detected - forcing low score', { originalScore: stress });
    }

    // Light symptoms without urgency
    if (
      /un.*peu.*mal|petite.*toux|léger|supportable.*mais|c'est.*gênant|je.*me.*sens.*bien/i.test(
        transcript
      )
    ) {
      stress = Math.min(stress, 32);
      logger.info('Minor symptoms detected - capping score', { originalScore: stress });
    }

    // Cap at 100
    return Math.min(100, Math.round(stress));
  }
}

// Export singleton instance
export const sentimentAnalysisService = new SentimentAnalysisService();
