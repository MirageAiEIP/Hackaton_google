import { logger } from '@/utils/logger';
import { loadSecrets } from '@/config/secrets.config';

export class ElevenLabsSTTService {
  private apiKey: string = '';
  private initialized = false;
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const secrets = await loadSecrets();
    this.apiKey = secrets.elevenlabsApiKey;

    this.initialized = true;
    logger.info('ElevenLabs STT Service initialized');
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    options: {
      languageCode?: string;
      diarize?: boolean;
      numSpeakers?: number;
      speaker?: 'operator' | 'patient';
    } = {}
  ): Promise<{
    text: string;
    languageCode: string;
    languageProbability: number;
    words?: Array<{
      text: string;
      start: number;
      end: number;
      speakerId?: string;
    }>;
  }> {
    await this.initialize();

    try {
      // Utiliser FormData natif de Node.js 18+ (compatible avec fetch)
      const formData = new FormData();

      // Model ID (scribe_v1 est le modèle standard, scribe_v1_experimental est en beta)
      formData.append('model_id', 'scribe_v1');

      // File format - Utiliser 'other' pour auto-detect (WebM, MP3, WAV, etc.)
      // Note: L'audio vient probablement du navigateur en WebM/Opus ou MP3
      formData.append('file_format', 'other');

      // Audio file - Créer un Blob à partir du Buffer
      // Le Blob est compatible avec FormData natif
      // Utiliser audio/webm comme type par défaut (format navigateur courant)
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      formData.append('file', audioBlob, `audio_${Date.now()}.webm`);

      // Language code (optionnel)
      if (options.languageCode) {
        formData.append('language_code', options.languageCode);
      }

      // Diarization (qui parle quand)
      if (options.diarize !== undefined) {
        formData.append('diarize', String(options.diarize));
      }

      // Nombre de speakers
      if (options.numSpeakers) {
        formData.append('num_speakers', String(options.numSpeakers));
      }

      // Timestamps granularity
      formData.append('timestamps_granularity', 'word');

      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          // Pas besoin de getHeaders() avec FormData natif
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs STT API error: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as {
        language_code: string;
        language_probability: number;
        text: string;
        words?: Array<{
          text: string;
          start: number;
          end: number;
          speaker_id?: string;
        }>;
      };

      logger.info('Audio transcribed successfully', {
        textLength: result.text.length,
        language: result.language_code,
        probability: result.language_probability,
        speaker: options.speaker,
      });

      return {
        text: result.text,
        languageCode: result.language_code,
        languageProbability: result.language_probability,
        words: result.words?.map((word) => ({
          text: word.text,
          start: word.start,
          end: word.end,
          speakerId: word.speaker_id,
        })),
      };
    } catch (error) {
      logger.error('Failed to transcribe audio', error as Error);
      throw error;
    }
  }

  async transcribeAudioChunk(
    audioChunk: Buffer,
    context: {
      callId: string;
      speaker: 'operator' | 'patient';
      sessionId: string;
    }
  ): Promise<{ text: string; partial: boolean } | null> {
    // Pour l'instant, on transcrit chaque chunk individuellement
    // Dans une version optimisée, on pourrait accumuler les chunks
    // et transcrire par batches de 5-10 secondes

    try {
      const result = await this.transcribeAudio(audioChunk, {
        languageCode: 'fr', // Français pour le SAMU
        diarize: false, // Pas besoin de diarization car on sait déjà qui parle
        speaker: context.speaker,
      });

      return {
        text: result.text,
        partial: false,
      };
    } catch (error) {
      logger.error('Failed to transcribe audio chunk', error as Error, context);
      return null;
    }
  }
}

// Export singleton instance
export const elevenLabsSTTService = new ElevenLabsSTTService();
