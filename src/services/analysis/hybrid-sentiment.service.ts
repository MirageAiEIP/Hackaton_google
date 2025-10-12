import { logger } from '@/utils/logger';
import type {
  AudioAnalysis,
  CoherenceType,
  HybridAnalysis,
  RecommendationType,
  SentimentAnalysisInput,
  SentimentType,
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
      let transcriptToAnalyze = input.transcript;
      let audioAnalysis: AudioAnalysis | null = null;
      let whisperFailed = false;

      if (input.audioUrl) {
        try {
          const { whisperService } = await import('./whisper.service');
          const whisperResult = await whisperService.transcribeWithTimestamps(input.audioUrl);
          transcriptToAnalyze = whisperResult.text;

          logger.info('Whisper transcription completed', {
            transcriptLength: transcriptToAnalyze.length,
            preview: transcriptToAnalyze.substring(0, 100),
          });

          audioAnalysis = await this.audioService.analyzeAudio(input.audioUrl, whisperResult);
        } catch (whisperError) {
          whisperFailed = true;
          logger.warn('Whisper failed, using provided transcript', {
            error: whisperError,
            hasProvidedTranscript: !!input.transcript && input.transcript.length > 10,
          });

          if (input.transcript && input.transcript.length > 10) {
            transcriptToAnalyze = input.transcript;
          } else {
            throw new Error('Whisper failed and no transcript provided');
          }
        }
      }

      let textAnalysis;
      try {
        textAnalysis = await this.textService.analyzeText(transcriptToAnalyze);
      } catch (geminiError) {
        logger.warn('Gemini failed, using keyword analysis', { error: geminiError });
        textAnalysis = this.analyzeWithKeywordsOnly(transcriptToAnalyze);
      }

      const result = this.fuse(textAnalysis, audioAnalysis);

      if (whisperFailed || !audioAnalysis) {
        result.reasoning = `[Mode dégradé] ${result.reasoning}`;
      }

      logger.info('Hybrid sentiment analysis completed', {
        callId: input.callId,
        finalScore: result.finalScore,
        recommendation: result.recommendation,
        coherence: result.coherence,
        fallbackUsed: whisperFailed,
      });

      return result;
    } catch (error) {
      logger.error('Hybrid sentiment analysis completely failed', error as Error, {
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

        if (textScore >= 85) {
          reasoning += 'Détresse verbale extrême détectée - PRIORITÉ MAINTENUE malgré voix calme.';
        } else {
          reasoning += 'Possiblement anxiété disproportionnée. Priorité maintenue par précaution.';
        }
      }
    } else {
      coherence = 'COHERENT';
      finalScore = textScore * 0.6 + audioScore * 0.4;

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

  private calculateClinicalBonus(indicators: string[]): number {
    let bonus = 0;

    if (indicators.includes('DYSPNEA')) {
      bonus += 6;
    }
    if (indicators.includes('WEAKNESS')) {
      bonus += 5;
    }
    if (indicators.includes('CONFUSION')) {
      bonus += 10;
    }
    if (indicators.includes('PAIN_VOCALIZATION')) {
      bonus += 7;
    }
    if (indicators.includes('PANIC')) {
      bonus += 8;
    }
    if (indicators.includes('DISTRESS')) {
      bonus += 7;
    }
    if (indicators.includes('ALTERED_CONSCIOUSNESS')) {
      bonus += 12;
    }

    return bonus;
  }

  private getRecommendation(score: number): RecommendationType {
    if (score >= 70) {
      return 'INCREASE_PRIORITY';
    }
    if (score <= 35) {
      return 'DECREASE_PRIORITY';
    }
    return 'MAINTAIN';
  }

  private calculatePointsAdjustment(score: number): number {
    if (score < 30) {
      return 0;
    }
    if (score < 50) {
      return 1;
    }
    if (score < 70) {
      return 2;
    }
    if (score < 85) {
      return 5;
    }
    return 10;
  }

  private analyzeWithKeywordsOnly(transcript: string): TextAnalysis {
    const lower = transcript.toLowerCase();
    let score = 50; // Neutre par défaut

    // Urgences vitales
    if (/mourir|vais mourir|ne respire plus|inconscient|saigne beaucoup/.test(lower)) {
      score = 95;
    }
    // AVC
    else if (/bouche.*tordu|bras.*paralys|parle.*bizarre/.test(lower)) {
      score = 90;
    }
    // Douleur thoracique
    else if (/douleur.*poitrine|mal.*poitrine|oppression/.test(lower)) {
      score = 80;
    }
    // Détresse respiratoire
    else if (/arrive.*plus.*respirer|étouffe|suffoque/.test(lower)) {
      score = 85;
    }
    // Urgences modérées
    else if (/très mal|insupportable|aidez-moi/.test(lower)) {
      score = 65;
    }
    // Non urgent
    else if (/renseignement|pharmacie.*garde|médecin.*garde/.test(lower)) {
      score = 15;
    }
    // Symptômes légers
    else if (/un peu mal|léger|petite toux/.test(lower)) {
      score = 30;
    }

    const sentiment: SentimentType =
      score >= 80 ? 'PANICKED' : score >= 60 ? 'ANXIOUS' : score >= 40 ? 'IN_PAIN' : 'CALM';

    return {
      sentiment,
      stressLevel: score,
      urgencyMarkers: [],
      painLanguage: score,
      coherence: 50,
      confidence: 0.5,
    };
  }

  private getDefaultAnalysis(_transcriptLength: number): HybridAnalysis {
    const estimatedScore = 50;

    return {
      textScore: estimatedScore,
      audioScore: 0,
      finalScore: estimatedScore,
      coherence: 'COHERENT',
      recommendation: 'MAINTAIN',
      pointsAdjustment: this.calculatePointsAdjustment(estimatedScore),
      confidence: 0.3,
      reasoning: 'Analyse par défaut - révision manuelle requise',
    };
  }
}

export const hybridSentimentService = new HybridSentimentService();
