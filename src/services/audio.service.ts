import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { elevenlabsConversationService } from './elevenlabs-conversation.service';
import { storageService } from './storage.service';

/**
 * Service for managing call audio recordings
 * Handles fetching, storing, and streaming audio
 */
export class AudioService {
  /**
   * Get audio URL for a call
   * Returns existing URL or fetches from ElevenLabs if not yet saved
   */
  async getCallAudio(callId: string): Promise<{
    hasAudio: boolean;
    audioUrl?: string;
    source: 'database' | 'elevenlabs' | 'none';
    mimeType?: string;
  }> {
    logger.info('Getting audio for call', { callId });

    // Check if audio URL exists in Call table
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    // Priority 1: Check Call.audioRecordingUrl
    if (call.audioRecordingUrl) {
      logger.info('Audio URL found in Call table', { callId, url: call.audioRecordingUrl });
      return {
        hasAudio: true,
        audioUrl: call.audioRecordingUrl,
        source: 'database',
        mimeType: this.getMimeTypeFromUrl(call.audioRecordingUrl),
      };
    }

    // Priority 2: Check ElevenLabsConversation.audioUrl
    if (call.elevenLabsConversation?.audioUrl) {
      logger.info('Audio URL found in ElevenLabsConversation table', {
        callId,
        url: call.elevenLabsConversation.audioUrl,
      });
      return {
        hasAudio: true,
        audioUrl: call.elevenLabsConversation.audioUrl,
        source: 'database',
        mimeType: 'audio/mpeg',
      };
    }

    // Priority 3: Try to fetch from ElevenLabs API
    if (call.elevenLabsConversation?.conversationId) {
      logger.info('Attempting to fetch audio from ElevenLabs', {
        callId,
        conversationId: call.elevenLabsConversation.conversationId,
      });

      try {
        const audioBase64 = await elevenlabsConversationService.getConversationAudio(
          call.elevenLabsConversation.conversationId
        );

        // Convert base64 to data URL
        const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

        // Update database with audio URL
        await prisma.elevenLabsConversation.update({
          where: { id: call.elevenLabsConversation.id },
          data: {
            hasAudio: true,
            audioUrl,
          },
        });

        logger.info('Audio fetched and saved successfully', { callId });

        return {
          hasAudio: true,
          audioUrl,
          source: 'elevenlabs',
          mimeType: 'audio/mpeg',
        };
      } catch (error) {
        logger.error('Failed to fetch audio from ElevenLabs', error as Error, { callId });
      }
    }

    logger.warn('No audio available for call', { callId });

    return {
      hasAudio: false,
      source: 'none',
    };
  }

  /**
   * Get audio as streaming buffer
   * Fetches audio and returns as buffer for streaming
   */
  async getCallAudioBuffer(callId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
  } | null> {
    const audioData = await this.getCallAudio(callId);

    if (!audioData.hasAudio || !audioData.audioUrl) {
      return null;
    }

    // Handle data URL (base64)
    if (audioData.audioUrl.startsWith('data:')) {
      const parts = audioData.audioUrl.split(',');
      const base64Data = parts[1] || '';
      const buffer = Buffer.from(base64Data, 'base64');

      return {
        buffer,
        mimeType: audioData.mimeType || 'audio/mpeg',
      };
    }

    // Handle HTTP(S) URL
    if (audioData.audioUrl.startsWith('http://') || audioData.audioUrl.startsWith('https://')) {
      try {
        const response = await fetch(audioData.audioUrl, {
          method: 'GET',
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
          buffer,
          mimeType: audioData.mimeType || 'audio/mpeg',
        };
      } catch (error) {
        logger.error('Failed to fetch audio from URL', error as Error, {
          callId,
          url: audioData.audioUrl,
        });
        return null;
      }
    }

    // Handle Cloud Storage URL (gs://)
    if (audioData.audioUrl.startsWith('gs://')) {
      try {
        const buffer = await storageService.downloadAudio(audioData.audioUrl);
        return {
          buffer,
          mimeType: audioData.mimeType || 'audio/mpeg',
        };
      } catch (error) {
        logger.error('Failed to fetch audio from Cloud Storage', error as Error, {
          callId,
          url: audioData.audioUrl,
        });
        return null;
      }
    }

    logger.error('Unsupported audio URL format', new Error('Unsupported URL format'), {
      callId,
      url: audioData.audioUrl,
    });
    return null;
  }

  /**
   * Upload audio to Cloud Storage and update database
   * Useful for archiving audio from data URLs
   */
  async uploadAudioToStorage(callId: string, conversationId: string): Promise<string | null> {
    logger.info('Uploading audio to Cloud Storage', { callId, conversationId });

    try {
      // Get audio buffer
      const audioData = await this.getCallAudioBuffer(callId);

      if (!audioData) {
        logger.warn('No audio buffer available for upload', { callId });
        return null;
      }

      // Upload to Cloud Storage
      const fileName = `${conversationId}.mp3`;
      const cloudUrl = await storageService.uploadAudio(audioData.buffer, conversationId, fileName);

      logger.info('Audio uploaded to Cloud Storage', { callId, cloudUrl });

      // Update database
      await prisma.elevenLabsConversation.update({
        where: { conversationId },
        data: {
          audioUrl: cloudUrl,
        },
      });

      await prisma.call.update({
        where: { id: callId },
        data: {
          audioRecordingUrl: cloudUrl,
        },
      });

      return cloudUrl;
    } catch (error) {
      logger.error('Failed to upload audio to storage', error as Error, { callId });
      return null;
    }
  }

  /**
   * Get audio metadata (duration, size, format)
   */
  async getAudioMetadata(callId: string): Promise<{
    hasAudio: boolean;
    duration?: number;
    size?: number;
    format?: string;
    source?: string;
  }> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    const hasAudio =
      !!call.audioRecordingUrl ||
      !!call.elevenLabsConversation?.audioUrl ||
      !!call.elevenLabsConversation?.hasAudio;

    if (!hasAudio) {
      return { hasAudio: false };
    }

    // Get audio buffer to determine size
    const audioData = await this.getCallAudioBuffer(callId);

    return {
      hasAudio: true,
      duration: call.elevenLabsConversation?.durationSeconds || call.duration || undefined,
      size: audioData?.buffer.length,
      format: audioData?.mimeType || 'audio/mpeg',
      source: call.elevenLabsConversation?.conversationId
        ? 'elevenlabs'
        : call.audioRecordingUrl
          ? 'twilio'
          : 'unknown',
    };
  }

  /**
   * List all calls with available audio
   */
  async listCallsWithAudio(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<
    Array<{
      callId: string;
      status: string;
      startedAt: Date;
      endedAt: Date | null;
      hasAudio: boolean;
      audioSource: string;
      duration: number | null;
    }>
  > {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const calls = await prisma.call.findMany({
      where: options.status
        ? {
            status: options.status as
              | 'IN_PROGRESS'
              | 'COMPLETED'
              | 'ESCALATED'
              | 'CANCELLED'
              | 'FAILED',
          }
        : undefined,
      include: {
        elevenLabsConversation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return calls.map((call) => ({
      callId: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      hasAudio:
        !!call.audioRecordingUrl ||
        !!call.elevenLabsConversation?.audioUrl ||
        !!call.elevenLabsConversation?.hasAudio,
      audioSource: call.elevenLabsConversation?.conversationId
        ? 'elevenlabs'
        : call.audioRecordingUrl
          ? 'twilio'
          : 'none',
      duration: call.duration,
    }));
  }

  /**
   * Determine MIME type from URL
   */
  private getMimeTypeFromUrl(url: string): string {
    if (url.includes('.mp3')) {
      return 'audio/mpeg';
    }
    if (url.includes('.wav')) {
      return 'audio/wav';
    }
    if (url.includes('.ogg')) {
      return 'audio/ogg';
    }
    if (url.includes('.m4a')) {
      return 'audio/mp4';
    }
    if (url.startsWith('data:audio/')) {
      const match = url.match(/^data:(audio\/[^;]+);/);
      return match && match[1] ? match[1] : 'audio/mpeg';
    }
    return 'audio/mpeg'; // Default
  }

  /**
   * Delete audio recording (cleanup)
   */
  async deleteAudio(callId: string): Promise<boolean> {
    logger.info('Deleting audio for call', { callId });

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    try {
      // Delete from Cloud Storage if stored there
      if (call.audioRecordingUrl?.startsWith('gs://')) {
        try {
          await storageService.deleteAudio(call.audioRecordingUrl);
        } catch (error) {
          logger.warn('Failed to delete audio from storage', {
            error: (error as Error).message,
          });
        }
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          audioRecordingUrl: null,
        },
      });

      if (call.elevenLabsConversation) {
        await prisma.elevenLabsConversation.update({
          where: { id: call.elevenLabsConversation.id },
          data: {
            audioUrl: null,
            hasAudio: false,
          },
        });
      }

      logger.info('Audio deleted successfully', { callId });
      return true;
    } catch (error) {
      logger.error('Failed to delete audio', error as Error, { callId });
      return false;
    }
  }
}

export const audioService = new AudioService();
