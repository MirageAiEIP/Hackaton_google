import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridSentimentService } from './hybrid-sentiment.service';
import { sentimentAnalysisService } from './sentiment-analysis.service';
import { audioAnalysisService } from './audio-analysis.service';
import type { TextAnalysis, AudioAnalysis } from '@/types/sentiment.types';

vi.mock('./sentiment-analysis.service', () => ({
  sentimentAnalysisService: {
    analyzeText: vi.fn(),
  },
}));

vi.mock('./audio-analysis.service', () => ({
  audioAnalysisService: {
    analyzeAudio: vi.fn(),
  },
}));

vi.mock('./whisper.service', () => ({
  whisperService: {
    transcribeWithTimestamps: vi.fn(),
  },
}));

describe('HybridSentimentService', () => {
  let service: HybridSentimentService;

  beforeEach(() => {
    service = new HybridSentimentService();
    vi.clearAllMocks();
  });

  describe('analyzeHybrid - coherent fusion', () => {
    it('should fuse coherent text and audio scores (60/40 weight)', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'ANXIOUS',
        stressLevel: 70,
        urgencyMarkers: ['TEMPORAL_URGENCY'],
        painLanguage: 70,
        coherence: 80,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 180, variance: 30, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 160, classification: 'FAST' },
          volume: { mean: 70, classification: 'NORMAL' },
        },
        breathiness: 40,
        pauses: { frequency: 5, avgDuration: 500, longPauses: 1 },
        vocalStress: 60,
        clinicalIndicators: [],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai mal à la tête depuis ce matin",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-1',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Expected: 70 * 0.6 + 60 * 0.4 = 42 + 24 = 66
      expect(result.finalScore).toBeCloseTo(66, 0);
      expect(result.coherence).toBe('COHERENT');
      expect(result.textScore).toBe(70);
      expect(result.audioScore).toBe(60);
      expect(result.recommendation).toBe('MAINTAIN');
    });

    it('should add clinical bonus when coherent', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'IN_PAIN',
        stressLevel: 60,
        urgencyMarkers: [],
        painLanguage: 60,
        coherence: 85,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 180, variance: 30, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 140, classification: 'NORMAL' },
          volume: { mean: 65, classification: 'NORMAL' },
        },
        breathiness: 30,
        pauses: { frequency: 3, avgDuration: 400, longPauses: 0 },
        vocalStress: 65,
        clinicalIndicators: ['DYSPNEA', 'PAIN_VOCALIZATION'],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai du mal à respirer et j'ai mal",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-2',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Base: 60 * 0.6 + 65 * 0.4 = 36 + 26 = 62
      // Bonus: DYSPNEA (6) + PAIN_VOCALIZATION (7) = 13
      // Total: 62 + 13 = 75
      expect(result.finalScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendation).toBe('INCREASE_PRIORITY');
    });
  });

  describe('analyzeHybrid - incoherent detection', () => {
    it('should detect incoherence when audio > text (patient minimizing)', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'CALM',
        stressLevel: 30,
        urgencyMarkers: [],
        painLanguage: 30,
        coherence: 90,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 200, variance: 40, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 180, classification: 'FAST' },
          volume: { mean: 75, classification: 'NORMAL' },
        },
        breathiness: 60,
        pauses: { frequency: 8, avgDuration: 600, longPauses: 2 },
        vocalStress: 80,
        clinicalIndicators: ['DYSPNEA', 'PANIC'],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "C'est pas grave, juste un peu mal",
        words: [{ word: "C'est", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-3',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Difference: 80 - 30 = 50 > 30 → INCOHERENT
      // Take audio score (patient minimizing)
      expect(result.coherence).toBe('INCOHERENT');
      expect(result.finalScore).toBe(80);
      expect(result.reasoning).toContain('minimise');
      expect(result.recommendation).toBe('INCREASE_PRIORITY');
    });

    it('should detect incoherence when text > audio (anxiety)', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'PANICKED',
        stressLevel: 90,
        urgencyMarkers: ['DEATH_ANXIETY', 'SHOUTING'],
        painLanguage: 90,
        coherence: 75,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 150, variance: 20, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 120, classification: 'NORMAL' },
          volume: { mean: 65, classification: 'NORMAL' },
        },
        breathiness: 20,
        pauses: { frequency: 2, avgDuration: 300, longPauses: 0 },
        vocalStress: 40,
        clinicalIndicators: [],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'JE VAIS MOURIR AIDEZ-MOI',
        words: [{ word: 'JE', start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-4',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Difference: 90 - 40 = 50 > 30 → INCOHERENT
      // Text >= 85 → MAINTAIN high priority
      expect(result.coherence).toBe('INCOHERENT');
      expect(result.finalScore).toBe(90);
      expect(result.reasoning).toContain('Détresse verbale extrême');
      expect(result.recommendation).toBe('INCREASE_PRIORITY');
    });

    it('should reduce confidence for incoherent analysis', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'PANICKED',
        stressLevel: 85,
        urgencyMarkers: ['TEMPORAL_URGENCY'],
        painLanguage: 85,
        coherence: 80,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 150, variance: 20, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 120, classification: 'NORMAL' },
          volume: { mean: 65, classification: 'NORMAL' },
        },
        breathiness: 20,
        pauses: { frequency: 2, avgDuration: 300, longPauses: 0 },
        vocalStress: 30,
        clinicalIndicators: [],
        confidence: 0.8,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'Aidez-moi vite',
        words: [{ word: 'Aidez-moi', start: 0, end: 0.5 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-5',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Confidence reduced by 30% for incoherence
      // min(0.9, 0.8) * 0.7 = 0.8 * 0.7 = 0.56
      expect(result.confidence).toBeCloseTo(0.56, 1);
    });
  });

  describe('analyzeHybrid - recommendations', () => {
    it('should recommend INCREASE_PRIORITY for score >= 70', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'IN_PAIN',
        stressLevel: 75,
        urgencyMarkers: [],
        painLanguage: 75,
        coherence: 85,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 170, variance: 30, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 150, classification: 'NORMAL' },
          volume: { mean: 70, classification: 'NORMAL' },
        },
        breathiness: 35,
        pauses: { frequency: 4, avgDuration: 450, longPauses: 0 },
        vocalStress: 70,
        clinicalIndicators: [],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai très mal à la poitrine",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-6',
        transcript: '',
        audioUrl: 'test.wav',
      });

      expect(result.finalScore).toBeGreaterThanOrEqual(70);
      expect(result.recommendation).toBe('INCREASE_PRIORITY');
      expect(result.pointsAdjustment).toBeGreaterThanOrEqual(2);
    });

    it('should recommend DECREASE_PRIORITY for score <= 35', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'CALM',
        stressLevel: 20,
        urgencyMarkers: [],
        painLanguage: 20,
        coherence: 95,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 150, variance: 20, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 120, classification: 'NORMAL' },
          volume: { mean: 65, classification: 'NORMAL' },
        },
        breathiness: 10,
        pauses: { frequency: 1, avgDuration: 250, longPauses: 0 },
        vocalStress: 15,
        clinicalIndicators: [],
        confidence: 0.9,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'Je voudrais la pharmacie de garde',
        words: [{ word: 'Je', start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-7',
        transcript: '',
        audioUrl: 'test.wav',
      });

      expect(result.finalScore).toBeLessThanOrEqual(35);
      expect(result.recommendation).toBe('DECREASE_PRIORITY');
      expect(result.pointsAdjustment).toBeLessThanOrEqual(1);
    });

    it('should recommend MAINTAIN for mid-range scores', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'ANXIOUS',
        stressLevel: 50,
        urgencyMarkers: [],
        painLanguage: 50,
        coherence: 85,
        confidence: 0.85,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 160, variance: 25, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 130, classification: 'NORMAL' },
          volume: { mean: 67, classification: 'NORMAL' },
        },
        breathiness: 25,
        pauses: { frequency: 3, avgDuration: 350, longPauses: 0 },
        vocalStress: 45,
        clinicalIndicators: [],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai mal au ventre depuis ce matin",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-8',
        transcript: '',
        audioUrl: 'test.wav',
      });

      expect(result.finalScore).toBeGreaterThan(35);
      expect(result.finalScore).toBeLessThan(70);
      expect(result.recommendation).toBe('MAINTAIN');
    });
  });

  describe('analyzeHybrid - fallback mechanisms', () => {
    it('should fallback to provided transcript if Whisper fails', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'ANXIOUS',
        stressLevel: 60,
        urgencyMarkers: [],
        painLanguage: 60,
        coherence: 80,
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockRejectedValue(
        new Error('Whisper API error')
      );

      const result = await service.analyzeHybrid({
        callId: 'test-9',
        transcript: "J'ai mal à la tête",
        audioUrl: 'test.wav',
      });

      expect(result.textScore).toBe(60);
      expect(result.audioScore).toBe(0);
      expect(result.finalScore).toBe(60);
      expect(result.reasoning).toContain('[Mode dégradé]');
    });

    it('should fail if Whisper fails and no transcript provided', async () => {
      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockRejectedValue(
        new Error('Whisper API error')
      );

      const result = await service.analyzeHybrid({
        callId: 'test-10',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Should return default analysis
      expect(result.finalScore).toBe(50);
      expect(result.confidence).toBe(0.3);
      expect(result.reasoning).toContain('révision manuelle requise');
    });

    it('should use keyword analysis if Gemini fails', async () => {
      vi.mocked(sentimentAnalysisService.analyzeText).mockRejectedValue(
        new Error('Gemini API error')
      );

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 200, variance: 40, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 180, classification: 'FAST' },
          volume: { mean: 75, classification: 'NORMAL' },
        },
        breathiness: 50,
        pauses: { frequency: 6, avgDuration: 500, longPauses: 1 },
        vocalStress: 85,
        clinicalIndicators: ['PANIC'],
        confidence: 0.8,
      };

      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'Mon mari ne respire plus !',
        words: [{ word: 'Mon', start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-11',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Keyword analysis should detect "ne respire plus" as critical
      expect(result.textScore).toBeGreaterThanOrEqual(85);
      expect(result.finalScore).toBeGreaterThan(70);
    });

    it('should use text-only if audio confidence is too low', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'IN_PAIN',
        stressLevel: 70,
        urgencyMarkers: ['SEVERE_PAIN_LANGUAGE'],
        painLanguage: 70,
        coherence: 85,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 150, variance: 20, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 120, classification: 'NORMAL' },
          volume: { mean: 65, classification: 'NORMAL' },
        },
        breathiness: 10,
        pauses: { frequency: 1, avgDuration: 200, longPauses: 0 },
        vocalStress: 20,
        clinicalIndicators: [],
        confidence: 0.2, // Too low
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai très mal",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-12',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Should use text score only
      expect(result.finalScore).toBe(70);
      expect(result.audioScore).toBe(0);
      expect(result.reasoning).toContain('audio non disponible ou qualité insuffisante');
    });

    it('should work with text-only (no audio)', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'ANXIOUS',
        stressLevel: 55,
        urgencyMarkers: [],
        painLanguage: 55,
        coherence: 85,
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);

      const result = await service.analyzeHybrid({
        callId: 'test-13',
        transcript: "J'ai un peu de fièvre",
        audioUrl: undefined,
      });

      expect(result.textScore).toBe(55);
      expect(result.audioScore).toBe(0);
      expect(result.finalScore).toBe(55);
      expect(result.reasoning).toContain('Analyse textuelle uniquement');
    });
  });

  describe('clinical bonus calculation', () => {
    it('should apply correct bonus for DYSPNEA', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'IN_PAIN',
        stressLevel: 50,
        urgencyMarkers: [],
        painLanguage: 50,
        coherence: 85,
        confidence: 0.9,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 170, variance: 30, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 150, classification: 'NORMAL' },
          volume: { mean: 70, classification: 'NORMAL' },
        },
        breathiness: 40,
        pauses: { frequency: 5, avgDuration: 500, longPauses: 1 },
        vocalStress: 55,
        clinicalIndicators: ['DYSPNEA'],
        confidence: 0.85,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: "J'ai du mal à respirer",
        words: [{ word: "J'ai", start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-14',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Base: 50 * 0.6 + 55 * 0.4 = 30 + 22 = 52
      // Bonus: DYSPNEA = +6
      // Total: 52 + 6 = 58
      expect(result.finalScore).toBeCloseTo(58, 0);
      expect(result.reasoning).toContain('DYSPNEA');
    });

    it('should apply correct bonus for multiple clinical indicators', async () => {
      const mockTextAnalysis: TextAnalysis = {
        sentiment: 'PANICKED',
        stressLevel: 60,
        urgencyMarkers: [],
        painLanguage: 60,
        coherence: 70,
        confidence: 0.85,
      };

      const mockAudioAnalysis: AudioAnalysis = {
        prosody: {
          pitch: { mean: 190, variance: 35, classification: 'NORMAL' },
          tempo: { wordsPerMinute: 170, classification: 'FAST' },
          volume: { mean: 72, classification: 'NORMAL' },
        },
        breathiness: 55,
        pauses: { frequency: 7, avgDuration: 550, longPauses: 2 },
        vocalStress: 70,
        clinicalIndicators: ['DYSPNEA', 'PANIC', 'CONFUSION'],
        confidence: 0.8,
      };

      vi.mocked(sentimentAnalysisService.analyzeText).mockResolvedValue(mockTextAnalysis);
      vi.mocked(audioAnalysisService.analyzeAudio).mockResolvedValue(mockAudioAnalysis);

      const { whisperService } = await import('./whisper.service');
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'Aide respire mal confus',
        words: [{ word: 'Aide', start: 0, end: 0.2 }],
      });

      const result = await service.analyzeHybrid({
        callId: 'test-15',
        transcript: '',
        audioUrl: 'test.wav',
      });

      // Base: 60 * 0.6 + 70 * 0.4 = 36 + 28 = 64
      // Bonus: DYSPNEA (6) + PANIC (8) + CONFUSION (10) = 24
      // Total: 64 + 24 = 88
      expect(result.finalScore).toBeGreaterThanOrEqual(85);
      expect(result.reasoning).toContain('DYSPNEA');
      expect(result.reasoning).toContain('PANIC');
      expect(result.reasoning).toContain('CONFUSION');
    });
  });
});
