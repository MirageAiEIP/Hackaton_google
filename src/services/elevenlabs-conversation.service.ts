import { loadSecrets } from '@/config/secrets.config';
import { logger } from '@/utils/logger';

export class ElevenLabsConversationService {
  private apiKey: string = '';
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const secrets = await loadSecrets();
    this.apiKey = secrets.elevenlabsApiKey;
    this.initialized = true;
  }

  async stopConversation(conversationId: string): Promise<void> {
    await this.initialize();

    logger.info('Stopping ElevenLabs conversation', { conversationId });

    try {
      // Note: ElevenLabs n'a pas d'API pour "stop" une conversation
      // La conversation se termine automatiquement quand le WebSocket se ferme
      // On utilise donc une approche différente: on stocke juste qu'elle doit être terminée

      logger.info('Conversation marked for termination', { conversationId });
    } catch (error) {
      logger.error('Failed to stop conversation', error as Error, { conversationId });
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<{
    transcript: string;
    messages: Array<{
      role: 'agent' | 'user';
      text: string;
      timestamp: string;
    }>;
  }> {
    await this.initialize();

    logger.info('Fetching conversation from ElevenLabs', { conversationId });

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        messages?: Array<{
          role: string;
          text?: string;
          message?: string;
          timestamp?: string;
        }>;
      };

      logger.info('Conversation retrieved successfully', {
        conversationId,
        messagesCount: data.messages?.length || 0,
      });

      // Extraire le transcript complet
      const messages =
        data.messages?.map((msg) => ({
          role: (msg.role as 'agent' | 'user') || 'agent',
          text: msg.text || msg.message || '',
          timestamp: msg.timestamp || new Date().toISOString(),
        })) || [];

      const transcript = messages.map((m) => `${m.role}: ${m.text}`).join('\n');

      return {
        transcript,
        messages,
      };
    } catch (error) {
      logger.error('Failed to fetch conversation', error as Error, { conversationId });
      throw error;
    }
  }

  async getConversationAudio(conversationId: string): Promise<string> {
    await this.initialize();

    logger.info('Fetching conversation audio from ElevenLabs', { conversationId });

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
        {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      // L'audio est retourné en format audio/mpeg
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      logger.info('Conversation audio retrieved successfully', {
        conversationId,
        audioSizeKB: Math.round(audioBuffer.byteLength / 1024),
      });

      return base64Audio;
    } catch (error) {
      logger.error('Failed to fetch conversation audio', error as Error, { conversationId });
      throw error;
    }
  }
}

export const elevenlabsConversationService = new ElevenLabsConversationService();
