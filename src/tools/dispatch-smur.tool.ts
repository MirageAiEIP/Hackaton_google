import { z } from 'zod';
import { dispatchService } from '@/services/dispatch.service';
import { logger } from '@/utils/logger';
import { TwilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';

export const dispatchSMURTool = {
  description:
    'Dispatche les secours SMUR pour urgences absolues (P0) ou vitales (P1). À utiliser uniquement pour arrêt cardiaque, AVC, hémorragie massive, détresse respiratoire sévère.',
  parameters: z.object({
    conversation_id: z.string().optional().describe('ID de conversation ElevenLabs (fourni auto)'),
    priority: z
      .enum(['P0', 'P1'])
      .describe(
        "Priorité de l'urgence : P0 pour urgence absolue (arrêt cardiaque), P1 pour urgence vitale (AVC, détresse respiratoire)"
      ),
    location: z
      .string()
      .describe('Adresse complète du patient (rue, ville, code postal, étage, code accès)'),
    symptoms: z.string().describe('Description des symptômes urgents'),
  }),
  execute: async ({
    conversation_id,
    priority,
    location,
    symptoms,
  }: {
    conversation_id?: string;
    priority: 'P0' | 'P1';
    location: string;
    symptoms: string;
  }) => {
    // Résoudre le callId depuis conversationId
    let callId: string | undefined;
    if (conversation_id) {
      callId = TwilioElevenLabsProxyService.getCallIdFromConversation(conversation_id);
      logger.info('Resolved callId from conversationId', {
        conversationId: conversation_id,
        callId,
      });
    }
    logger.info('Dispatching SMUR', {
      priority,
      location,
      callId,
    });

    try {
      const result = await dispatchService.createDispatch({
        priority,
        location,
        symptoms,
        callId,
      });

      const eta = priority === 'P0' ? '5-10 minutes' : '10-20 minutes';

      logger.info('SMUR dispatched successfully', {
        dispatchId: result.dispatch.dispatchId,
        callId: result.callId,
        priority,
      });

      return {
        success: true,
        dispatchId: result.dispatch.dispatchId,
        callId: result.callId,
        eta,
        message: `Les secours SMUR sont en route vers ${location}. Temps d'arrivée estimé: ${eta}. Restez avec le patient et suivez les instructions.`,
      };
    } catch (error) {
      logger.error('SMUR dispatch failed', error as Error, {
        priority,
        location,
      });

      throw new Error(`Impossible de dispatcher le SMUR: ${(error as Error).message}`);
    }
  },
};
