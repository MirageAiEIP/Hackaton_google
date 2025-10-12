import OpenAI from 'openai';
import { createReadStream, writeFileSync, unlinkSync, existsSync } from 'fs';
import { logger } from '@/utils/logger';
import { loadSecrets } from '@/config/secrets.config';
import { storageService } from '@/services/storage.service';
import path from 'path';

/**
 * Service for audio transcription using OpenAI Whisper API
 */
export class WhisperService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    // Initialization is lazy (done on first use)
  }

  private async ensureInitialized(): Promise<void> {
    if (this.client) {
      return;
    }

    // Load API key from Secret Manager or env
    const secrets = await loadSecrets();
    this.apiKey = secrets.openaiApiKey || process.env.OPENAI_API_KEY || null;

    if (!this.apiKey) {
      throw new Error('OpenAI API key not found in Secret Manager or environment variables');
    }

    this.client = new OpenAI({ apiKey: this.apiKey });
    logger.info('Whisper service initialized successfully');
  }

  /**
   * Get local file path (download from GCS if needed)
   */
  private async getLocalPath(audioPath: string): Promise<{ path: string; isTemp: boolean }> {
    // If it's a GCS URI (gs://)
    if (audioPath.startsWith('gs://')) {
      logger.info('Downloading audio from GCS', { audioPath });

      const buffer = await storageService.downloadAudio(audioPath);
      const tempPath = path.join(process.cwd(), 'temp-audio', `whisper-${Date.now()}.wav`);

      writeFileSync(tempPath, buffer);

      return { path: tempPath, isTemp: true };
    }

    // If it's a local file
    if (existsSync(audioPath)) {
      return { path: audioPath, isTemp: false };
    }

    throw new Error(`Audio file not found: ${audioPath}`);
  }

  /**
   * Cleanup temporary file
   */
  private cleanupTemp(filePath: string): void {
    try {
      unlinkSync(filePath);
      logger.info('Temporary file cleaned up', { filePath });
    } catch (error) {
      logger.warn('Failed to cleanup temporary file', { filePath, error });
    }
  }

  /** Transcribe audio file to text */
  async transcribe(audioPath: string): Promise<string> {
    // Ensure service is initialized with API key from Secret Manager
    await this.ensureInitialized();

    logger.info('Starting Whisper transcription', { audioPath });

    const { path: localPath, isTemp } = await this.getLocalPath(audioPath);

    try {
      if (!this.client) {
        throw new Error('Whisper service not initialized');
      }

      const transcription = await this.client.audio.transcriptions.create({
        file: createReadStream(localPath),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'text',
      });

      logger.info('Whisper transcription completed', {
        transcriptionLength: transcription.length,
        preview: transcription.substring(0, 100),
      });

      return transcription;
    } catch (error) {
      logger.error('Whisper transcription failed', error as Error, { audioPath });
      throw error;
    } finally {
      if (isTemp) {
        this.cleanupTemp(localPath);
      }
    }
  }

  /** Transcribe with word-level timestamps for pause/tempo analysis */
  async transcribeWithTimestamps(audioPath: string): Promise<{
    text: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }> {
    // Ensure service is initialized with API key from Secret Manager
    await this.ensureInitialized();

    logger.info('Starting Whisper transcription with timestamps', { audioPath });

    const { path: localPath, isTemp } = await this.getLocalPath(audioPath);

    try {
      if (!this.client) {
        throw new Error('Whisper service not initialized');
      }

      const response = await this.client.audio.transcriptions.create({
        file: createReadStream(localPath),
        model: 'whisper-1',
        language: 'fr',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      });

      logger.info('Whisper transcription with timestamps completed', {
        text: response.text,
        wordsCount: response.words?.length || 0,
      });

      return {
        text: response.text,
        words: response.words?.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
      };
    } catch (error) {
      logger.error('Whisper transcription with timestamps failed', error as Error, { audioPath });
      throw error;
    } finally {
      if (isTemp) {
        this.cleanupTemp(localPath);
      }
    }
  }
}

export const whisperService = new WhisperService();
