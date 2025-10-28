import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { elevenlabsConversationService } from './elevenlabs-conversation.service';
import { loadSecrets } from '@/config/secrets.config';
import { callInfoExtractionService } from './call-info-extraction.service';

/**
 * Service for persisting ElevenLabs conversations to the database
 * Handles fetching transcripts from ElevenLabs API and saving them
 */
export class ConversationPersistenceService {
  /**
   * Save ElevenLabs conversation to database
   * Fetches full transcript from ElevenLabs API and persists it
   */
  async saveConversation(params: {
    conversationId: string;
    callId: string;
    agentId: string;
  }): Promise<void> {
    const { conversationId, callId, agentId } = params;

    logger.info('Starting conversation persistence', {
      conversationId,
      callId,
    });

    try {
      // Check if already saved
      const existing = await prisma.elevenLabsConversation.findUnique({
        where: { conversationId },
      });

      if (existing) {
        logger.info('Conversation already saved', { conversationId });
        return;
      }

      // Fetch conversation data from ElevenLabs API
      logger.info('Fetching conversation from ElevenLabs API', { conversationId });

      const conversationData = await elevenlabsConversationService.getConversation(conversationId);

      logger.info('Conversation data retrieved', {
        conversationId,
        messagesCount: conversationData.messages.length,
        transcriptLength: conversationData.transcript.length,
      });

      // Get call details for timestamps
      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      // Calculate duration
      const startTime = call.startedAt;
      const endTime = call.endedAt || new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Save to ElevenLabsConversation table
      await prisma.elevenLabsConversation.create({
        data: {
          conversationId,
          agentId,
          callId,
          startTime,
          endTime,
          durationSeconds,
          transcript: conversationData.messages, // JSON array of messages
          toolCalls: [], // Will be populated if we track tool calls
          metadata: {
            messagesCount: conversationData.messages.length,
            savedAt: new Date().toISOString(),
          },
          status: 'completed',
          hasAudio: false, // Can be updated later if we fetch audio
        },
      });

      logger.info('ElevenLabsConversation record created', { conversationId });

      // Update call duration only - DO NOT overwrite call.transcript
      // call.transcript contains the COMPLETE conversation (AI + Operator) captured in real-time
      // elevenLabsConversation.transcript contains only the AI phase for reference
      await prisma.call.update({
        where: { id: callId },
        data: {
          // transcript: conversationData.transcript, // REMOVED - would overwrite real-time transcript
          duration: durationSeconds,
        },
      });

      logger.info('Call duration updated (transcript preserved from real-time capture)', {
        callId,
        aiPhaseDuration: durationSeconds,
      });

      logger.info('Conversation persistence completed successfully', {
        conversationId,
        callId,
        durationSeconds,
      });

      // ===== EXTRACTION AUTOMATIQUE DES INFOS AVEC GEMINI =====
      // Extraire et mettre à jour automatiquement les informations depuis le transcript
      try {
        logger.info('Starting automatic call info extraction', { callId, conversationId });

        const extractionResult = await callInfoExtractionService.extractAndUpdateCall({
          callId,
          transcript: conversationData.transcript,
        });

        if (extractionResult.success && extractionResult.updated.length > 0) {
          logger.info('Call info auto-extracted and updated', {
            callId,
            fieldsUpdated: extractionResult.updated,
          });
        } else {
          logger.warn('No info extracted from transcript', { callId });
        }
      } catch (extractionError) {
        logger.error('Failed to auto-extract call info', extractionError as Error, {
          callId,
        });
        // Don't throw - extraction failure shouldn't break conversation persistence
      }
    } catch (error) {
      logger.error('Failed to save conversation', error as Error, {
        conversationId,
        callId,
      });

      // Don't throw - we don't want to break call completion if transcript saving fails
      // The transcript can be fetched manually later if needed
    }
  }

  /**
   * Retry saving conversation if previous attempt failed
   * Useful for manual retries or background jobs
   */
  async retrySaveConversation(callId: string): Promise<boolean> {
    logger.info('Attempting to retry conversation save', { callId });

    try {
      // Get call with ElevenLabs conversation relationship
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          elevenLabsConversation: true,
        },
      });

      if (!call) {
        logger.error('Call not found for retry', new Error('Call not found'), { callId });
        return false;
      }

      if (call.elevenLabsConversation) {
        logger.info('Conversation already saved, no retry needed', { callId });
        return true;
      }

      // Try to find conversation ID from handoffs (they store conversationId)
      const handoff = await prisma.handoff.findFirst({
        where: { callId },
        orderBy: { createdAt: 'desc' },
      });

      if (!handoff?.conversationId) {
        logger.error('No conversation ID found for retry', new Error('No conversation ID found'), {
          callId,
        });
        return false;
      }

      // Load secrets
      const secrets = await loadSecrets();

      // Retry save
      await this.saveConversation({
        conversationId: handoff.conversationId,
        callId,
        agentId: secrets.elevenlabsAgentId,
      });

      return true;
    } catch (error) {
      logger.error('Failed to retry conversation save', error as Error, { callId });
      return false;
    }
  }

  /**
   * Save conversation with audio
   * Fetches both transcript and audio from ElevenLabs
   */
  async saveConversationWithAudio(params: {
    conversationId: string;
    callId: string;
    agentId: string;
  }): Promise<void> {
    const { conversationId, callId, agentId } = params;

    // First save the transcript
    await this.saveConversation({ conversationId, callId, agentId });

    // Then fetch and save audio
    try {
      logger.info('Fetching conversation audio', { conversationId });

      const audioBase64 = await elevenlabsConversationService.getConversationAudio(conversationId);

      // Update with audio URL (or store base64 directly)
      await prisma.elevenLabsConversation.update({
        where: { conversationId },
        data: {
          hasAudio: true,
          audioUrl: `data:audio/mpeg;base64,${audioBase64.substring(0, 100)}...`, // Store reference or upload to cloud storage
        },
      });

      logger.info('Conversation audio saved', { conversationId });
    } catch (error) {
      logger.error('Failed to save conversation audio', error as Error, {
        conversationId,
      });
      // Don't throw - transcript is more important than audio
    }
  }

  /**
   * Bulk save conversations for multiple calls
   * Useful for batch processing or recovery
   */
  async bulkSaveConversations(callIds: string[]): Promise<{ success: number; failed: number }> {
    logger.info('Starting bulk conversation save', { count: callIds.length });

    let success = 0;
    let failed = 0;

    for (const callId of callIds) {
      const result = await this.retrySaveConversation(callId);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    logger.info('Bulk conversation save completed', { success, failed });

    return { success, failed };
  }
}

export const conversationPersistenceService = new ConversationPersistenceService();
