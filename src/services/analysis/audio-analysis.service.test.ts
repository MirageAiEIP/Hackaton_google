import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioAnalysisService } from './audio-analysis.service';
import { whisperService } from './whisper.service';

vi.mock('./whisper.service', () => ({
  whisperService: {
    transcribeWithTimestamps: vi.fn(),
  },
}));

describe('AudioAnalysisService', () => {
  let service: AudioAnalysisService;

  beforeEach(() => {
    service = new AudioAnalysisService();
    vi.clearAllMocks();
  });

  describe('analyzeAudio', () => {
    it('should detect high vocal stress from punctuation', async () => {
      const transcriptionResult = {
        text: 'Aidez-moi ! Aidez-moi ! Je vais mourir !',
        words: [
          { word: 'Aidez-moi', start: 0, end: 0.5 },
          { word: 'Aidez-moi', start: 0.6, end: 1.1 },
          { word: 'Je', start: 1.2, end: 1.3 },
          { word: 'vais', start: 1.4, end: 1.6 },
          { word: 'mourir', start: 1.7, end: 2.0 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.vocalStress).toBeGreaterThan(50);
      expect(result.clinicalIndicators).toContain('PANIC');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect DYSPNEA clinical indicator', async () => {
      const transcriptionResult = {
        text: "Je n'arrive plus à respirer ! Je suffoque !",
        words: [
          { word: 'Je', start: 0, end: 0.2 },
          { word: "n'arrive", start: 0.3, end: 0.6 },
          { word: 'plus', start: 0.7, end: 0.9 },
          { word: 'à', start: 1.0, end: 1.1 },
          { word: 'respirer', start: 1.2, end: 1.6 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.clinicalIndicators).toContain('DYSPNEA');
      // 2 exclamations * 15 + 2 urgent keywords (respire, suffoque) * 10 = 50
      expect(result.vocalStress).toBeGreaterThan(30);
    });

    it('should detect PAIN_VOCALIZATION clinical indicator', async () => {
      const transcriptionResult = {
        text: "J'ai très mal, c'est une douleur insupportable",
        words: [
          { word: "J'ai", start: 0, end: 0.2 },
          { word: 'très', start: 0.3, end: 0.5 },
          { word: 'mal', start: 0.6, end: 0.8 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.clinicalIndicators).toContain('PAIN_VOCALIZATION');
    });

    it('should detect WEAKNESS clinical indicator', async () => {
      const transcriptionResult = {
        text: 'Je me sens très faible et fatigué',
        words: [
          { word: 'Je', start: 0, end: 0.2 },
          { word: 'me', start: 0.3, end: 0.4 },
          { word: 'sens', start: 0.5, end: 0.7 },
          { word: 'très', start: 0.8, end: 1.0 },
          { word: 'faible', start: 1.1, end: 1.4 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.clinicalIndicators).toContain('WEAKNESS');
    });

    it('should detect PANIC only with urgency words AND exclamation', async () => {
      const transcriptionResultWithoutExclamation = {
        text: 'Aidez-moi svp',
        words: [{ word: 'Aidez-moi', start: 0, end: 0.5 }],
      };

      const resultNoExclamation = await service.analyzeAudio(
        'test.wav',
        transcriptionResultWithoutExclamation
      );
      expect(resultNoExclamation.clinicalIndicators).not.toContain('PANIC');

      const transcriptionResultWithExclamation = {
        text: 'Aidez-moi !',
        words: [{ word: 'Aidez-moi', start: 0, end: 0.5 }],
      };

      const resultWithExclamation = await service.analyzeAudio(
        'test.wav',
        transcriptionResultWithExclamation
      );
      expect(resultWithExclamation.clinicalIndicators).toContain('PANIC');
    });

    it('should calculate low vocal stress for calm speech', async () => {
      const transcriptionResult = {
        text: 'Bonjour je voudrais un renseignement',
        words: [
          { word: 'Bonjour', start: 0, end: 0.4 },
          { word: 'je', start: 0.5, end: 0.6 },
          { word: 'voudrais', start: 0.7, end: 1.0 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.vocalStress).toBeLessThan(30);
      expect(result.clinicalIndicators).toHaveLength(0);
    });

    it('should calculate vocal stress from exclamation marks', async () => {
      const transcriptionResult = {
        text: 'Aide ! Aide ! Vite !',
        words: [
          { word: 'Aide', start: 0, end: 0.3 },
          { word: 'Aide', start: 0.4, end: 0.7 },
          { word: 'Vite', start: 0.8, end: 1.0 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 3 exclamations * 15 + 1 urgent keyword * 10 = 55
      expect(result.vocalStress).toBeGreaterThanOrEqual(45);
    });

    it('should calculate vocal stress from ellipsis', async () => {
      const transcriptionResult = {
        text: 'Je... je sais pas... peut-être...',
        words: [
          { word: 'Je', start: 0, end: 0.2 },
          { word: 'je', start: 0.5, end: 0.6 },
          { word: 'sais', start: 1.0, end: 1.2 },
          { word: 'pas', start: 1.5, end: 1.7 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 3 ellipsis * 8 = 24
      expect(result.vocalStress).toBeGreaterThanOrEqual(20);
    });

    it('should calculate vocal stress from uppercase words', async () => {
      const transcriptionResult = {
        text: 'AIDE VITE URGENT',
        words: [
          { word: 'AIDE', start: 0, end: 0.3 },
          { word: 'VITE', start: 0.4, end: 0.6 },
          { word: 'URGENT', start: 0.7, end: 1.0 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 3 capital words * 20 + 3 urgent keywords * 10 = 90
      expect(result.vocalStress).toBeGreaterThanOrEqual(80);
    });

    it('should cap vocal stress at 100', async () => {
      const transcriptionResult = {
        text: 'AIDE ! AIDE ! MOURIR ! URGENT ! DOULEUR ! SECOURS ! AIDE ! AIDE ! AIDE !',
        words: [{ word: 'AIDE', start: 0, end: 0.5 }],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.vocalStress).toBeLessThanOrEqual(100);
    });

    it('should calculate tempo from word timings - FAST', async () => {
      const transcriptionResult = {
        text: 'vite vite vite aide aide aide',
        words: [
          { word: 'vite', start: 0.0, end: 0.1 },
          { word: 'vite', start: 0.1, end: 0.2 },
          { word: 'vite', start: 0.2, end: 0.3 },
          { word: 'aide', start: 0.3, end: 0.4 },
          { word: 'aide', start: 0.4, end: 0.5 },
          { word: 'aide', start: 0.5, end: 0.6 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 6 words in 0.6s = 600 words/min (very fast)
      expect(result.prosody.tempo.classification).toBe('FAST');
      expect(result.prosody.tempo.wordsPerMinute).toBeGreaterThan(180);
    });

    it('should calculate tempo from word timings - SLOW', async () => {
      const transcriptionResult = {
        text: 'je... suis... faible...',
        words: [
          { word: 'je', start: 0.0, end: 0.5 },
          { word: 'suis', start: 1.0, end: 1.5 },
          { word: 'faible', start: 2.5, end: 3.0 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 3 words in 3s = 60 words/min (slow)
      expect(result.prosody.tempo.classification).toBe('SLOW');
      expect(result.prosody.tempo.wordsPerMinute).toBeLessThan(80);
    });

    it('should calculate tempo from word timings - NORMAL', async () => {
      const transcriptionResult = {
        text: 'Bonjour je voudrais un renseignement',
        words: [
          { word: 'Bonjour', start: 0.0, end: 0.4 },
          { word: 'je', start: 0.5, end: 0.6 },
          { word: 'voudrais', start: 0.7, end: 1.0 },
          { word: 'un', start: 1.1, end: 1.2 },
          { word: 'renseignement', start: 1.3, end: 1.8 },
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      // 5 words in 1.8s ≈ 167 words/min (normal)
      expect(result.prosody.tempo.classification).toBe('NORMAL');
      expect(result.prosody.tempo.wordsPerMinute).toBeGreaterThan(80);
      expect(result.prosody.tempo.wordsPerMinute).toBeLessThan(180);
    });

    it('should analyze pauses from word timings', async () => {
      const transcriptionResult = {
        text: 'Je... suis... très mal',
        words: [
          { word: 'Je', start: 0.0, end: 0.2 },
          { word: 'suis', start: 1.5, end: 1.7 }, // 1.3s pause
          { word: 'très', start: 2.0, end: 2.2 }, // 0.3s pause
          { word: 'mal', start: 5.5, end: 5.7 }, // 3.3s long pause
        ],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.pauses.longPauses).toBeGreaterThan(0);
      expect(result.pauses.avgDuration).toBeGreaterThan(500);
    });

    it('should return default analysis on error', async () => {
      vi.mocked(whisperService.transcribeWithTimestamps).mockRejectedValue(
        new Error('Whisper error')
      );

      const result = await service.analyzeAudio('test.wav');

      expect(result.vocalStress).toBe(0);
      expect(result.clinicalIndicators).toHaveLength(0);
      expect(result.confidence).toBe(0.1);
    });

    it('should transcribe if no transcription provided', async () => {
      vi.mocked(whisperService.transcribeWithTimestamps).mockResolvedValue({
        text: 'Test transcription',
        words: [{ word: 'Test', start: 0, end: 0.5 }],
      });

      const result = await service.analyzeAudio('test.wav');

      expect(whisperService.transcribeWithTimestamps).toHaveBeenCalledWith('test.wav');
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    it('should use provided transcription and skip Whisper call', async () => {
      const transcriptionResult = {
        text: 'Already transcribed',
        words: [{ word: 'Already', start: 0, end: 0.5 }],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(whisperService.transcribeWithTimestamps).not.toHaveBeenCalled();
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle empty words array gracefully', async () => {
      const transcriptionResult = {
        text: 'Test',
        words: [],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.prosody.tempo.classification).toBe('NORMAL');
      expect(result.pauses.frequency).toBe(0);
    });

    it('should handle undefined words array gracefully', async () => {
      const transcriptionResult = {
        text: 'Test',
        words: undefined,
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.prosody.tempo.classification).toBe('NORMAL');
      expect(result.pauses.frequency).toBe(0);
    });

    it('should reduce confidence for very short transcriptions', async () => {
      const transcriptionResult = {
        text: 'Oui',
        words: [{ word: 'Oui', start: 0, end: 0.2 }],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should extract arousal from punctuation', async () => {
      const transcriptionResult = {
        text: 'Aide ! Vite ! Urgent !',
        words: [{ word: 'Aide', start: 0, end: 0.3 }],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.emotionDimensions?.arousal).toBeGreaterThan(0.5);
    });

    it('should set low dominance for urgent words', async () => {
      const transcriptionResult = {
        text: 'Aidez-moi je vais mourir',
        words: [{ word: 'Aidez-moi', start: 0, end: 0.5 }],
      };

      const result = await service.analyzeAudio('test.wav', transcriptionResult);

      expect(result.emotionDimensions?.dominance).toBeLessThan(0.5);
    });
  });
});
