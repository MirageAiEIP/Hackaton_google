import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { logger } from '@/utils/logger';

/**
 * Service for audio transcription using OpenAI Whisper API
 */
export class WhisperService {
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    this.client = new OpenAI({ apiKey });
  }

  /** Transcribe audio file to text */
  async transcribe(audioPath: string): Promise<string> {
    logger.info('Starting Whisper transcription', { audioPath });

    try {
      const transcription = await this.client.audio.transcriptions.create({
        file: createReadStream(audioPath),
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
    }
  }

  /** Transcribe with word-level timestamps for pause/tempo analysis */
  async transcribeWithTimestamps(audioPath: string): Promise<{
    text: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }> {
    logger.info('Starting Whisper transcription with timestamps', { audioPath });

    try {
      const response = await this.client.audio.transcriptions.create({
        file: createReadStream(audioPath),
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
    }
  }
}

export const whisperService = new WhisperService();
