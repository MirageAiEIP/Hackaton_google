import { GoogleGenAI } from '@google/genai';
import { config } from '@/config';
import { loadSecrets } from '@/config/secrets.config';
import { logger } from '@/utils/logger';
import type { SemanticAnalysis, SentimentType } from '@/types/sentiment.types';

/**
 * Service d'analyse avec Google Gemini
 * Remplace Claude - GRATUIT avec 300$ de crédits Google!
 */
export class GeminiService {
  private genAI: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    // Initialization is lazy (done on first use)
  }

  private async ensureInitialized(): Promise<void> {
    if (this.genAI) {
      return;
    }

    // Load API key from Secret Manager or env
    const secrets = await loadSecrets();
    this.apiKey = secrets.googleApiKey || config.ai.apiKey || null;

    if (!this.apiKey) {
      throw new Error('Google API key not found in Secret Manager or environment variables');
    }

    this.genAI = new GoogleGenAI({
      apiKey: this.apiKey,
    });

    logger.info('Gemini service initialized successfully');
  }

  async analyzeText(transcript: string): Promise<SemanticAnalysis> {
    // Ensure service is initialized with API key from Secret Manager
    await this.ensureInitialized();

    logger.info('Starting Gemini sentiment analysis', {
      transcriptLength: transcript.length,
    });

    try {
      const prompt = this.buildPrompt(transcript);

      if (!this.genAI) {
        throw new Error('Gemini service not initialized');
      }

      const response = await this.genAI.models.generateContent({
        model: config.ai.model,
        contents: prompt,
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini returned empty response');
      }

      const analysis = this.parseResponse(text);

      logger.info('Gemini sentiment analysis completed', {
        sentiment: analysis.sentiment,
        painIntensity: analysis.painIntensity,
        confidence: analysis.confidence,
      });

      return analysis;
    } catch (error) {
      logger.error('Gemini sentiment analysis failed', error as Error, {
        transcriptPreview: transcript.substring(0, 100),
      });

      throw error;
    }
  }

  private buildPrompt(transcript: string): string {
    return `Tu es un médecin régulateur SAMU. UTILISE TOUTE L'ÉCHELLE 0-100, ne reste pas entre 40-60!

EXEMPLES SCORES 85-100 (URGENCE ABSOLUE):
- "Mon mari ne respire plus!" → painIntensity: 95
- "Ma femme, sa bouche est tordue, elle parle bizarre, son bras bouge plus" → painIntensity: 90 (AVC)
- "Il y a du sang partout!" → painIntensity: 92
- "J'arrive plus à respirer, aidez-moi!" → painIntensity: 88

EXEMPLES SCORES 70-84 (URGENCE IMPORTANTE):
- "J'ai très mal dans la poitrine, ça serre" → painIntensity: 78
- "Mon inhalateur marche pas, j'ai du mal à respirer" → painIntensity: 82

EXEMPLES SCORES 40-69 (MODÉRÉ):
- "J'ai très mal au ventre depuis ce matin" → painIntensity: 58
- "Mon enfant a 39.5 de fièvre" → painIntensity: 52
- "Je me suis tordu la cheville" → painIntensity: 48

EXEMPLES SCORES 0-39 (NON URGENT):
- "Je voudrais la pharmacie de garde" → painIntensity: 12
- "J'ai un peu mal à la tête" → painIntensity: 28
- "J'ai une petite toux depuis quelques jours" → painIntensity: 18

TRANSCRIPT:
"${transcript}"

RÈGLES ABSOLUES:
1. AVC (bouche tordue, bras paralysé, parole bizarre) = 88-95 OBLIGATOIRE
2. Douleur thoracique = 75-85 OBLIGATOIRE
3. "Aidez-moi", "je vais mourir" = 85-95
4. Demande d'information polie = 10-20 MAXIMUM
5. Mal de tête léger = 25-35 MAXIMUM
6. N'hésite PAS à donner 15 ou 95, sors de la zone 40-60!

Réponds UNIQUEMENT avec ce format JSON:
{
  "sentiment": "PANICKED",
  "painIntensity": 90,
  "coherence": 75,
  "confidence": 0.9,
  "reasoning": "Explication courte"
}`;
  }

  private parseResponse(text: string): SemanticAnalysis {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sentiment: this.validateSentiment(parsed.sentiment),
        painIntensity: Math.min(100, Math.max(0, parsed.painIntensity || 50)),
        coherence: Math.min(100, Math.max(0, parsed.coherence || 80)),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        reasoning: parsed.reasoning || 'Analyse complétée',
      };
    } catch (error) {
      logger.error('Failed to parse Gemini response', error as Error, { text });
      throw error;
    }
  }

  private validateSentiment(sentiment: string): SentimentType {
    const validSentiments: SentimentType[] = ['CALM', 'ANXIOUS', 'PANICKED', 'CONFUSED', 'IN_PAIN'];

    const normalized = sentiment.toUpperCase() as SentimentType;
    return validSentiments.includes(normalized) ? normalized : 'ANXIOUS';
  }
}

export const geminiService = new GeminiService();
