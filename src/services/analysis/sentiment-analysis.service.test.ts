import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { geminiService } from './gemini.service';
import type { SemanticAnalysis } from '@/types/sentiment.types';

vi.mock('./gemini.service', () => ({
  geminiService: {
    analyzeText: vi.fn(),
  },
}));

describe('SentimentAnalysisService', () => {
  let service: SentimentAnalysisService;

  beforeEach(() => {
    service = new SentimentAnalysisService();
    vi.clearAllMocks();
  });

  describe('analyzeText', () => {
    it('should detect P0 emergency - cardiac arrest', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 95,
        coherence: 70,
        confidence: 0.95,
        reasoning: 'Arrêt cardiaque imminent',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Mon mari ne respire plus ! Il va mourir !');

      expect(result.stressLevel).toBeGreaterThanOrEqual(85);
      expect(result.sentiment).toBe('PANICKED');
      expect(result.urgencyMarkers).toContain('DEATH_ANXIETY');
    });

    it('should detect P0 emergency - stroke (AVC)', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 88,
        coherence: 60,
        confidence: 0.9,
        reasoning: 'Signes AVC',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText(
        'Ma femme, sa bouche est tordue, elle parle bizarre, son bras bouge plus'
      );

      expect(result.stressLevel).toBeGreaterThanOrEqual(88);
      expect(result.sentiment).toBe('PANICKED');
    });

    it('should detect P2 emergency - chest pain', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'IN_PAIN',
        painIntensity: 75,
        coherence: 80,
        confidence: 0.85,
        reasoning: 'Douleur thoracique',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText(
        "J'ai très mal dans la poitrine, ça serre, j'ai du mal à respirer"
      );

      expect(result.stressLevel).toBeGreaterThanOrEqual(75);
      expect(result.sentiment).toBe('IN_PAIN');
      expect(result.urgencyMarkers).toContain('SEVERE_PAIN_LANGUAGE');
    });

    it('should detect P4-P5 non-urgent - pharmacy information', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CALM',
        painIntensity: 15,
        coherence: 95,
        confidence: 0.9,
        reasoning: 'Demande information',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Je voudrais la pharmacie de garde, svp');

      expect(result.stressLevel).toBeLessThanOrEqual(22);
      expect(result.sentiment).toBe('CALM');
      expect(result.urgencyMarkers).toHaveLength(0);
    });

    it('should detect P4 non-urgent - minor symptoms', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CALM',
        painIntensity: 30,
        coherence: 90,
        confidence: 0.85,
        reasoning: 'Symptômes légers',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText("J'ai un peu mal à la tête depuis ce matin");

      expect(result.stressLevel).toBeLessThanOrEqual(32);
      expect(result.sentiment).toBe('CALM');
    });

    it('should detect temporal urgency markers', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 85,
        coherence: 70,
        confidence: 0.9,
        reasoning: 'Urgence temporelle',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('VITE VITE VITE ! Aidez-moi maintenant !');

      expect(result.urgencyMarkers).toContain('TEMPORAL_URGENCY');
      expect(result.urgencyMarkers).toContain('REPETITIONS');
      expect(result.urgencyMarkers).toContain('SHOUTING');
    });

    it('should detect repetitions and panic', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 90,
        coherence: 60,
        confidence: 0.85,
        reasoning: 'Panique extrême',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Vite vite vite ! Aidez-moi ! Je vais mourir !');

      expect(result.urgencyMarkers).toContain('REPETITIONS');
      expect(result.urgencyMarkers).toContain('DEATH_ANXIETY');
      expect(result.urgencyMarkers).toContain('TEMPORAL_URGENCY');
    });

    it('should detect hesitations', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CONFUSED',
        painIntensity: 60,
        coherence: 40,
        confidence: 0.7,
        reasoning: 'Confusion cognitive',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText("Je... je sais pas... j'ai mal... mais...");

      expect(result.urgencyMarkers).toContain('HESITATIONS');
      expect(result.sentiment).toBe('CONFUSED');
    });

    it('should force minimum score for respiratory distress', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'ANXIOUS',
        painIntensity: 50,
        coherence: 80,
        confidence: 0.8,
        reasoning: 'Détresse respiratoire',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText("J'arrive plus à respirer, je suffoque");

      expect(result.stressLevel).toBeGreaterThanOrEqual(85);
    });

    it('should penalize low coherence', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CONFUSED',
        painIntensity: 60,
        coherence: 30,
        confidence: 0.6,
        reasoning: 'Discours incohérent',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Mal... tête... je... quoi... respire...');

      expect(result.stressLevel).toBeGreaterThanOrEqual(70);
      expect(result.sentiment).toBe('CONFUSED');
    });

    it('should handle Gemini API failure gracefully', async () => {
      vi.mocked(geminiService.analyzeText).mockRejectedValue(new Error('Gemini API error'));

      await expect(service.analyzeText('Test transcript')).rejects.toThrow(
        'Text sentiment analysis failed'
      );
    });

    it('should add bonus points for urgency markers', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 70,
        coherence: 75,
        confidence: 0.85,
        reasoning: 'Urgence avec marqueurs',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('VITE VITE VITE ! AIDEZ-MOI ! Je vais mourir !');

      // Markers: SHOUTING (uppercase), TEMPORAL_URGENCY (vite/aidez-moi), DEATH_ANXIETY (mourir), REPETITIONS (vite vite vite)
      // Base score 70 + markers bonus = +12 points
      // Then forced to 85 minimum due to PANICKED sentiment
      expect(result.stressLevel).toBeGreaterThanOrEqual(85);
      expect(result.urgencyMarkers.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('detectUrgencyMarkers', () => {
    it('should detect severe pain language', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'IN_PAIN',
        painIntensity: 80,
        coherence: 80,
        confidence: 0.9,
        reasoning: 'Douleur intense',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText("C'est insupportable, j'ai atrocement mal");

      expect(result.urgencyMarkers).toContain('SEVERE_PAIN_LANGUAGE');
    });

    it('should detect shouting (uppercase)', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 85,
        coherence: 75,
        confidence: 0.9,
        reasoning: 'Cris',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('AIDEZ-MOI MAINTENANT');

      expect(result.urgencyMarkers).toContain('SHOUTING');
    });

    it('should NOT detect shouting for normal capitalization', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CALM',
        painIntensity: 20,
        coherence: 95,
        confidence: 0.9,
        reasoning: 'Calme',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Je voudrais un renseignement svp');

      expect(result.urgencyMarkers).not.toContain('SHOUTING');
    });
  });

  describe('edge cases', () => {
    it('should cap stress level at 100', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'PANICKED',
        painIntensity: 98,
        coherence: 20,
        confidence: 0.95,
        reasoning: 'Urgence absolue',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText(
        'MOURIR ! AIDE ! VITE ! MOURIR ! AIDEZ-MOI ! VITE ! VITE ! SECOURS !'
      );

      expect(result.stressLevel).toBeLessThanOrEqual(100);
    });

    it('should handle empty urgency markers', async () => {
      const mockGeminiResponse: SemanticAnalysis = {
        sentiment: 'CALM',
        painIntensity: 10,
        coherence: 95,
        confidence: 0.9,
        reasoning: 'Aucune urgence',
      };

      vi.mocked(geminiService.analyzeText).mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeText('Bonjour, je voudrais un conseil médical');

      expect(result.urgencyMarkers).toHaveLength(0);
      expect(result.stressLevel).toBeLessThan(30);
    });
  });
});
