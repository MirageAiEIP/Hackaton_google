import { logger } from '@/utils/logger';
import type { AudioAnalysis, ClinicalIndicator } from '@/types/sentiment.types';
import { whisperService } from './whisper.service';

/**
 * Service d'analyse vocale basée sur la transcription
 * Analyse la ponctuation, les pauses et les patterns linguistiques
 */
export class AudioAnalysisService {
  constructor(private readonly whisper = whisperService) {}

  async analyzeAudio(
    audioUrl: string,
    transcriptionResult?: {
      text: string;
      words?: Array<{ word: string; start: number; end: number }>;
    }
  ): Promise<AudioAnalysis> {
    logger.info('Starting vocal analysis', { audioUrl });

    try {
      // Si pas de transcription fournie, on transcrit
      if (!transcriptionResult) {
        transcriptionResult = await this.whisper.transcribeWithTimestamps(audioUrl);
      }

      logger.info('Audio transcription completed', {
        text: transcriptionResult.text,
        wordCount: transcriptionResult.words?.length || 0,
      });

      const vocalStress = this.analyzeVocalStressFromTranscription(transcriptionResult.text);
      const clinicalIndicators = this.detectClinicalIndicatorsFromText(transcriptionResult.text);
      const emotionDimensions = this.extractEmotionFromPunctuation(transcriptionResult.text);
      const prosody = transcriptionResult.words
        ? this.calculateProsodyFromTimings(transcriptionResult.words)
        : this.getDefaultProsody();

      const result: AudioAnalysis = {
        prosody,
        breathiness: this.calculateBreathiness(emotionDimensions),
        pauses: this.analyzePausesFromTimings(transcriptionResult.words || []),
        vocalStress,
        clinicalIndicators,
        confidence: this.calculateConfidence(transcriptionResult.text),
        emotionDimensions,
      };

      logger.info('Vocal analysis completed', {
        vocalStress,
        clinicalIndicators,
        arousal: emotionDimensions.arousal,
      });

      return result;
    } catch (error) {
      logger.error('Failed to analyze audio', error as Error, { audioUrl });
      return this.getDefaultAnalysis();
    }
  }

  private calculateProsodyFromTimings(
    words: Array<{ word: string; start: number; end: number }>
  ): AudioAnalysis['prosody'] {
    if (words.length === 0) {
      return this.getDefaultProsody();
    }

    const lastWord = words[words.length - 1];
    const firstWord = words[0];
    if (!lastWord || !firstWord) {
      return this.getDefaultProsody();
    }

    const duration = lastWord.end - firstWord.start;
    const wordsPerMinute = (words.length / duration) * 60;

    let tempoClassification: 'SLOW' | 'NORMAL' | 'FAST';
    if (wordsPerMinute < 80) {
      tempoClassification = 'SLOW';
    } else if (wordsPerMinute > 180) {
      tempoClassification = 'FAST';
    } else {
      tempoClassification = 'NORMAL';
    }

    return {
      pitch: {
        mean: 150,
        variance: 20,
        classification: 'NORMAL',
      },
      tempo: {
        wordsPerMinute: Math.round(wordsPerMinute),
        classification: tempoClassification,
      },
      volume: {
        mean: 65,
        classification: 'NORMAL',
      },
    };
  }

  private calculateBreathiness(dimensions: { arousal: number; dominance: number }): number {
    const breathiness = dimensions.arousal * (1 - dimensions.dominance);
    return Math.round(breathiness * 100);
  }

  private analyzePausesFromTimings(
    words: Array<{ word: string; start: number; end: number }>
  ): AudioAnalysis['pauses'] {
    if (words.length < 2) {
      return { frequency: 0, avgDuration: 0, longPauses: 0 };
    }

    const pauses: number[] = [];
    for (let i = 1; i < words.length; i++) {
      const currentWord = words[i];
      const previousWord = words[i - 1];
      if (!currentWord || !previousWord) {
        continue;
      }
      const pauseDuration = (currentWord.start - previousWord.end) * 1000;
      if (pauseDuration > 200) {
        pauses.push(pauseDuration);
      }
    }

    const lastWord = words[words.length - 1];
    const firstWord = words[0];
    if (!lastWord || !firstWord) {
      return { frequency: 0, avgDuration: 0, longPauses: 0 };
    }

    const totalDuration = lastWord.end - firstWord.start;
    const frequency = pauses.length > 0 ? (pauses.length / totalDuration) * 60 : 0;
    const avgDuration = pauses.length > 0 ? pauses.reduce((a, b) => a + b, 0) / pauses.length : 0;
    const longPauses = pauses.filter((p) => p > 3000).length;

    return {
      frequency: Math.round(frequency * 10) / 10,
      avgDuration: Math.round(avgDuration),
      longPauses,
    };
  }

  private analyzeVocalStressFromTranscription(text: string): number {
    let stress = 0;

    const exclamationMarks = (text.match(/!/g) || []).length;
    const questionMarks = (text.match(/\?/g) || []).length;
    const ellipsis = (text.match(/\.\.\./g) || []).length;
    const capitalWords = (text.match(/[A-Z]{2,}/g) || []).length;

    stress += exclamationMarks * 15;
    stress += questionMarks * 5;
    stress += ellipsis * 8;
    stress += capitalWords * 20;

    const urgentKeywords = /mourir|aide|secours|urgent|douleur|mal|saigne|respire/gi;
    const urgentMatches = (text.match(urgentKeywords) || []).length;
    stress += urgentMatches * 10;

    return Math.min(100, stress);
  }

  private detectClinicalIndicatorsFromText(text: string): ClinicalIndicator[] {
    const indicators: ClinicalIndicator[] = [];
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes('respire') ||
      lowerText.includes('souffle') ||
      lowerText.includes('étouffe')
    ) {
      indicators.push('DYSPNEA');
    }

    if (lowerText.includes('faible') || lowerText.includes('fatigue')) {
      indicators.push('WEAKNESS');
    }

    // PANIC nécessite urgence + ponctuation exclamative
    const hasPanicWords = /mourir|aide|secours/i.test(lowerText);
    const hasExclamation = text.includes('!');
    if (hasPanicWords && hasExclamation) {
      indicators.push('PANIC');
    }

    if (lowerText.includes('mal') || lowerText.includes('douleur')) {
      indicators.push('PAIN_VOCALIZATION');
    }

    return indicators;
  }

  private extractEmotionFromPunctuation(text: string): {
    arousal: number;
    dominance: number;
  } {
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;

    const arousal = Math.min(1.0, (exclamations + questions * 0.5) / 3);
    const hasUrgentWords = /mourir|aide|secours/i.test(text);
    const dominance = hasUrgentWords ? 0.2 : 0.5;

    return { arousal, dominance };
  }

  private calculateConfidence(transcription: string): number {
    let confidence = 0.8;

    if (!transcription || transcription.length < 5) {
      confidence *= 0.5;
    }

    return Math.round(confidence * 100) / 100;
  }

  private getDefaultProsody(): AudioAnalysis['prosody'] {
    return {
      pitch: { mean: 150, variance: 20, classification: 'NORMAL' },
      tempo: { wordsPerMinute: 120, classification: 'NORMAL' },
      volume: { mean: 65, classification: 'NORMAL' },
    };
  }

  private getDefaultAnalysis(): AudioAnalysis {
    return {
      prosody: this.getDefaultProsody(),
      breathiness: 0,
      pauses: { frequency: 0, avgDuration: 0, longPauses: 0 },
      vocalStress: 0,
      clinicalIndicators: [],
      confidence: 0.1,
    };
  }
}

export const audioAnalysisService = new AudioAnalysisService();
