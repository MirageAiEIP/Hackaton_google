import { logger } from '@/utils/logger';
import type {
  AudioAnalysis,
  CoherenceType,
  HybridAnalysis,
  RecommendationType,
  SentimentAnalysisInput,
  TextAnalysis,
} from '@/types/sentiment.types';
import { sentimentAnalysisService } from './sentiment-analysis.service';
import { audioAnalysisService } from './audio-analysis.service';

/**
 * Hybrid sentiment analysis combining text + audio
 */
export class HybridSentimentService {
  constructor(
    private readonly textService = sentimentAnalysisService,
    private readonly audioService = audioAnalysisService
  ) {}

  async analyzeHybrid(input: SentimentAnalysisInput): Promise<HybridAnalysis> {
    logger.info('Starting hybrid sentiment analysis', {
      callId: input.callId,
      hasAudio: !!input.audioUrl,
    });

    try {
      const textAnalysis = await this.textService.analyzeText(input.transcript);

      let audioAnalysis: AudioAnalysis | null = null;
      if (input.audioUrl) {
        audioAnalysis = await this.audioService.analyzeAudio(input.audioUrl);
      }

      const result = this.fuse(textAnalysis, audioAnalysis);

      logger.info('Hybrid sentiment analysis completed', {
        callId: input.callId,
        finalScore: result.finalScore,
        recommendation: result.recommendation,
        coherence: result.coherence,
      });

      return result;
    } catch (error) {
      logger.error('Hybrid sentiment analysis failed', error as Error, {
        callId: input.callId,
      });

      return this.getDefaultAnalysis(input.transcript.length);
    }
  }

  private fuse(text: TextAnalysis, audio: AudioAnalysis | null): HybridAnalysis {
    const textScore = text.stressLevel;

    if (!audio || audio.confidence < 0.3) {
      return {
        textScore,
        audioScore: 0,
        finalScore: textScore,
        coherence: 'COHERENT',
        recommendation: this.getRecommendation(textScore),
        pointsAdjustment: this.calculatePointsAdjustment(textScore),
        confidence: text.confidence,
        reasoning: 'Analyse textuelle uniquement (audio non disponible ou qualité insuffisante).',
      };
    }

    const audioScore = audio.vocalStress;
    const scoreDifference = Math.abs(textScore - audioScore);
    const isIncoherent = scoreDifference > 30;

    let finalScore: number;
    let reasoning: string;
    let coherence: CoherenceType;

    if (isIncoherent) {
      coherence = 'INCOHERENT';

      if (audioScore > textScore) {
        finalScore = audioScore;
        reasoning = `Incohérence détectée: Le patient semble ${text.sentiment.toLowerCase()} (texte ${textScore}/100) mais sa voix montre un stress vocal de ${audioScore}/100. `;
        reasoning += 'Possiblement minimise ses symptômes. ';

        if (audio.clinicalIndicators.length > 0) {
          reasoning += `Indicateurs cliniques: ${audio.clinicalIndicators.join(', ')}. `;
        }

        reasoning += 'Priorité AUGMENTÉE.';
      } else {
        finalScore = Math.max(textScore, audioScore);
        reasoning = `Incohérence détectée: Le patient exprime un stress élevé (texte ${textScore}/100) mais sa voix est relativement calme (${audioScore}/100). `;

        if (textScore >= 70) {
          reasoning += 'Détresse verbale élevée détectée - PRIORITÉ MAINTENUE malgré voix calme.';
        } else {
          reasoning += 'Possiblement anxiété disproportionnée. Priorité maintenue par précaution.';
        }
      }
    } else {
      coherence = 'COHERENT';
      finalScore = textScore * 0.4 + audioScore * 0.6;

      reasoning = `Cohérence texte-audio confirmée (différence: ${scoreDifference} points). `;
      reasoning += `Score texte: ${textScore}/100, score audio: ${audioScore}/100. `;
      reasoning += 'Les deux analyses convergent.';

      if (audio.clinicalIndicators.length > 0) {
        const bonusPoints = this.calculateClinicalBonus(audio.clinicalIndicators);
        finalScore += bonusPoints;
        reasoning += ` Indicateurs cliniques détectés: ${audio.clinicalIndicators.join(', ')} (+${bonusPoints} points).`;
      }
    }

    finalScore = Math.min(100, Math.round(finalScore));

    const confidence = isIncoherent
      ? Math.min(text.confidence, audio.confidence) * 0.7
      : Math.min(text.confidence, audio.confidence);

    return {
      textScore,
      audioScore,
      finalScore,
      coherence,
      recommendation: this.getRecommendation(finalScore),
      pointsAdjustment: this.calculatePointsAdjustment(finalScore),
      confidence: Math.round(confidence * 100) / 100,
      reasoning,
    };
  }

  private hasCriticalEmergencyKeywords(transcript: string): boolean {
    const criticalKeywords = [
      'mourir',
      'vais mourir',
      'je meurs',
      'arrêt cardiaque',
      'crise cardiaque',
      'infarctus',
      'ne respire plus',
      'étouffe',
      'saigne beaucoup',
      'hémorragie',
      'inconscient',
      'convulsions',
      'aidez-moi',
      'au secours',
      'urgence vitale',
    ];

    const lowerTranscript = transcript.toLowerCase();
    return criticalKeywords.some((keyword) => lowerTranscript.includes(keyword));
  }

  private calculateClinicalBonus(indicators: string[]): number {
    let bonus = 0;

    if (indicators.includes('DYSPNEA')) {
      bonus += 10;
    }
    if (indicators.includes('WEAKNESS')) {
      bonus += 10;
    }
    if (indicators.includes('CONFUSION')) {
      bonus += 15;
    }
    if (indicators.includes('PAIN_VOCALIZATION')) {
      bonus += 12;
    }
    if (indicators.includes('PANIC')) {
      bonus += 15;
    }
    if (indicators.includes('DISTRESS')) {
      bonus += 12;
    }
    if (indicators.includes('ALTERED_CONSCIOUSNESS')) {
      bonus += 20;
    }

    return bonus;
  }

  private getRecommendation(score: number): RecommendationType {
    if (score >= 70) {
      return 'INCREASE_PRIORITY';
    }
    if (score <= 30) {
      return 'DECREASE_PRIORITY';
    }
    return 'MAINTAIN';
  }

  private calculatePointsAdjustment(score: number): number {
    if (score < 30) {
      return 0;
    }
    if (score < 50) {
      return 3;
    }
    if (score < 70) {
      return 5;
    }
    if (score < 85) {
      return 8;
    }
    return 12;
  }

  private getDefaultAnalysis(transcriptLength: number): HybridAnalysis {
    const estimatedScore = transcriptLength > 200 ? 50 : 30;

    return {
      textScore: estimatedScore,
      audioScore: 0,
      finalScore: estimatedScore,
      coherence: 'COHERENT',
      recommendation: 'MAINTAIN',
      pointsAdjustment: this.calculatePointsAdjustment(estimatedScore),
      confidence: 0.3,
      reasoning: "Analyse par défaut (erreur lors de l'analyse détaillée)",
    };
  }
}

export const hybridSentimentService = new HybridSentimentService();
