import { logger } from '@/utils/logger';
import { loadSecrets } from '@/config/secrets.config';

interface ConversationListItem {
  agent_id: string;
  conversation_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  call_successful: 'success' | 'failure' | 'unknown';
  agent_name: string;
  transcript_summary?: string;
  call_summary_title?: string;
  direction: 'inbound' | 'outbound';
}

interface ConversationsListResponse {
  conversations: ConversationListItem[];
  has_more: boolean;
  next_cursor: string | null;
}

interface TranscriptMessage {
  role: 'user' | 'agent';
  time_in_call_secs: number;
  message: string;
}

interface ConversationDetails {
  agent_id: string;
  conversation_id: string;
  status: 'initiated' | 'in-progress' | 'processing' | 'done' | 'failed';
  transcript: TranscriptMessage[];
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
  };
  has_audio: boolean;
  has_user_audio: boolean;
  has_response_audio: boolean;
  user_id?: string | null;
  analysis?: {
    evaluation_result: string;
    evaluation_criteria_results: Record<string, unknown>;
  } | null;
}

interface ListConversationsParams {
  cursor?: string;
  agentId?: string;
  callSuccessful?: 'success' | 'failure' | 'unknown';
  pageSize?: number;
}

export class ElevenLabsConversationsService {
  private apiKey: string = '';
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const secrets = await loadSecrets();
      this.apiKey = secrets.elevenlabsApiKey;

      if (!this.apiKey) {
        logger.warn('ELEVENLABS_API_KEY not found in secrets');
      } else {
        logger.info('ElevenLabs Conversations Service initialized');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to load ElevenLabs API key from secrets', error as Error);
      throw error;
    }
  }

  async listConversations(
    params: ListConversationsParams = {}
  ): Promise<ConversationsListResponse> {
    await this.initialize();

    const { cursor, agentId, callSuccessful, pageSize = 30 } = params;

    const queryParams = new URLSearchParams();
    if (cursor) {
      queryParams.append('cursor', cursor);
    }
    if (agentId) {
      queryParams.append('agent_id', agentId);
    }
    if (callSuccessful) {
      queryParams.append('call_successful', callSuccessful);
    }
    if (pageSize) {
      queryParams.append('page_size', pageSize.toString());
    }

    const url = `${this.baseUrl}/convai/conversations?${queryParams.toString()}`;

    logger.info('Fetching conversations from ElevenLabs', { agentId, pageSize });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ConversationsListResponse;

      logger.info('Conversations retrieved', {
        count: data.conversations.length,
        hasMore: data.has_more,
      });

      return data;
    } catch (error) {
      logger.error('Failed to list conversations', error as Error);
      throw error;
    }
  }

  async getAllConversations(
    params: Omit<ListConversationsParams, 'cursor'> = {}
  ): Promise<ConversationListItem[]> {
    const allConversations: ConversationListItem[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    logger.info('Fetching all conversations (all pages)');

    while (hasMore) {
      const response = await this.listConversations({
        ...params,
        cursor,
      });

      allConversations.push(...response.conversations);
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;

      logger.info('Fetched page', {
        pageCount: response.conversations.length,
        totalSoFar: allConversations.length,
        hasMore,
      });
    }

    logger.info('All conversations retrieved', { total: allConversations.length });

    return allConversations;
  }

  async getConversationDetails(conversationId: string): Promise<ConversationDetails> {
    await this.initialize();

    const url = `${this.baseUrl}/convai/conversations/${conversationId}`;

    logger.info('Fetching conversation details', { conversationId });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ConversationDetails;

      logger.info('Conversation details retrieved', {
        conversationId,
        transcriptLength: data.transcript.length,
        duration: data.metadata.call_duration_secs,
      });

      return data;
    } catch (error) {
      logger.error('Failed to get conversation details', error as Error, { conversationId });
      throw error;
    }
  }

  async getConversationAudio(conversationId: string): Promise<Buffer> {
    await this.initialize();

    const url = `${this.baseUrl}/convai/conversations/${conversationId}/audio`;

    logger.info('Fetching conversation audio', { conversationId });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info('Conversation audio retrieved', {
        conversationId,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to get conversation audio', error as Error, { conversationId });
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.initialize();

    const url = `${this.baseUrl}/convai/conversations/${conversationId}`;

    logger.info('Deleting conversation', { conversationId });

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Conversation deleted', { conversationId });
    } catch (error) {
      logger.error('Failed to delete conversation', error as Error, { conversationId });
      throw error;
    }
  }

  formatTranscript(transcript: TranscriptMessage[]): string {
    return transcript
      .map((msg) => {
        const time = Math.floor(msg.time_in_call_secs);
        const role = msg.role === 'user' ? 'Patient' : 'Agent';
        return `[${time}s] ${role}: ${msg.message}`;
      })
      .join('\n');
  }

  extractToolCalls(
    transcript: TranscriptMessage[]
  ): Array<{ tool: string; time: number; params: string }> {
    const toolCalls: Array<{ tool: string; time: number; params: string }> = [];

    for (const msg of transcript) {
      // Chercher des patterns de tool calls dans les messages de l'agent
      if (msg.role === 'agent' && msg.message.includes('dispatchSMUR')) {
        toolCalls.push({
          tool: 'dispatchSMUR',
          time: msg.time_in_call_secs,
          params: msg.message,
        });
      }
    }

    return toolCalls;
  }
}

// Singleton instance
let conversationsServiceInstance: ElevenLabsConversationsService | null = null;

export const getElevenLabsConversationsService = (): ElevenLabsConversationsService => {
  if (!conversationsServiceInstance) {
    conversationsServiceInstance = new ElevenLabsConversationsService();
  }
  return conversationsServiceInstance;
};
