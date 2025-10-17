import { loadSecrets } from '@/config/secrets.config';
import { logger } from '@/utils/logger';

/**
 * Service pour interagir avec l'API ElevenLabs Conversational AI
 * Génère des signed URLs sécurisées pour les connexions WebSocket client
 */
export class ElevenLabsAgentService {
  private apiKey: string = '';
  private agentId: string = '';
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const secrets = await loadSecrets();
    this.apiKey = secrets.elevenlabsApiKey;

    // Agent ID depuis .env
    this.agentId = process.env.ELEVENLABS_AGENT_ID || '';

    if (!this.agentId) {
      throw new Error('ELEVENLABS_AGENT_ID is not configured in .env');
    }

    this.initialized = true;
    logger.info('ElevenLabs Agent Service initialized', { agentId: this.agentId });
  }

  /**
   * Génère une signed URL pour démarrer une conversation web
   * La signed URL est valide pendant 15 minutes
   * Le frontend utilisera cette URL pour se connecter via WebSocket
   *
   * @param includeConversationId - Si true, génère un conversation_id unique (URL à usage unique)
   * @returns Signed WebSocket URL
   */
  async getSignedUrl(includeConversationId: boolean = false): Promise<string> {
    await this.initialize();

    const queryParams = new URLSearchParams({
      agent_id: this.agentId,
      include_conversation_id: includeConversationId.toString(),
    });

    const url = `${this.baseUrl}/convai/conversation/get-signed-url?${queryParams}`;

    logger.debug('Requesting signed URL from ElevenLabs', {
      agentId: this.agentId,
      includeConversationId,
    });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to get signed URL from ElevenLabs', new Error(errorText), {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { signed_url: string };

      logger.info('Signed URL generated successfully', {
        agentId: this.agentId,
        urlLength: data.signed_url.length,
      });

      return data.signed_url;
    } catch (error) {
      logger.error('Failed to get signed URL', error as Error, {
        agentId: this.agentId,
      });
      throw error;
    }
  }

  /**
   * Retourne l'agent ID configuré
   */
  async getAgentId(): Promise<string> {
    await this.initialize();
    return this.agentId;
  }
}

// Singleton
export const elevenlabsAgentService = new ElevenLabsAgentService();
