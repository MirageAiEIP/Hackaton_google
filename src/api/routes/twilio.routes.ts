import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';

/**
 * Routes Twilio pour intégration téléphonique
 *
 * POST /inbound - Webhook Twilio pour appels entrants
 * POST /outbound - API pour lancer des appels sortants
 * POST /post-call-webhook - Webhook post-appel pour analytics
 *
 * Note: Les Client Tools de l'ancien système ElevenLabs Agent ont été retirés.
 * La nouvelle architecture utilise ConversationOrchestrator avec nos propres agents.
 */

export const twilioRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Webhook Twilio - Appels entrants
   * Twilio appelle ce endpoint quand un appel arrive sur votre numéro SAMU
   */
  app.post(
    '/inbound',
    {
      schema: {
        tags: ['twilio'],
        summary: 'Twilio inbound call webhook',
        description: 'Handles incoming calls from Twilio',
        body: {
          type: 'object',
          properties: {
            CallSid: { type: 'string', description: 'Twilio Call SID' },
            From: { type: 'string', description: 'Caller phone number' },
            To: { type: 'string', description: 'Called number (SAMU number)' },
            CallStatus: { type: 'string', description: 'Call status' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              callId: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        CallSid: string;
        From: string;
        To: string;
        CallStatus: string;
      };

      logger.info('Inbound Twilio call received', {
        callSid: body.CallSid,
        from: body.From,
        to: body.To,
        status: body.CallStatus,
      });

      try {
        // Créer l'appel en base de données
        const call = await callService.createCall({
          phoneNumber: body.From,
        });

        logger.info('Call created in database', {
          callId: call.id,
          callSid: body.CallSid,
        });

        // TODO: Initialiser ConversationOrchestrator pour cet appel
        // const orchestrator = new ConversationOrchestrator({
        //   sessionId: call.id,
        //   callId: call.id,
        // });
        // await orchestrator.start();

        return reply.status(200).send({
          success: true,
          callId: call.id,
          message: 'Call initialized successfully',
        });
      } catch (error) {
        logger.error('Failed to handle inbound call', error as Error, {
          callSid: body.CallSid,
        });

        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to initialize call',
        });
      }
    }
  );

  /**
   * API pour lancer un appel sortant via Twilio
   */
  app.post(
    '/outbound',
    {
      schema: {
        tags: ['twilio'],
        summary: 'Initiate outbound call',
        description: 'Start an outbound call via Twilio to a patient',
        body: {
          type: 'object',
          required: ['toNumber', 'reason'],
          properties: {
            toNumber: {
              type: 'string',
              description: 'Phone number to call (E.164 format, e.g. +33612345678)',
            },
            reason: {
              type: 'string',
              description: 'Reason for call (e.g. Follow-up after emergency)',
            },
            patientId: {
              type: 'string',
              description: 'Optional patient ID for context',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              callId: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z.object({
        toNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
        reason: z.string().min(3),
        patientId: z.string().optional(),
      });

      const body = bodySchema.parse(request.body);

      logger.info('Outbound call requested', {
        toNumber: body.toNumber,
        reason: body.reason,
      });

      try {
        // Créer l'appel en DB
        const call = await callService.createCall({
          phoneNumber: body.toNumber,
        });

        // TODO: Implémenter l'appel sortant via Twilio SDK
        // const twilioClient = new twilio(accountSid, authToken);
        // const twilioCall = await twilioClient.calls.create({
        //   to: body.toNumber,
        //   from: process.env.TWILIO_PHONE_NUMBER,
        //   url: 'https://your-domain.com/api/v1/twilio/twiml',
        // });

        logger.info('Outbound call initiated successfully', {
          callId: call.id,
        });

        return {
          success: true,
          callId: call.id,
          message: 'Appel en cours...',
        };
      } catch (error) {
        logger.error('Failed to initiate outbound call', error as Error);
        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to start call',
        });
      }
    }
  );

  /**
   * Post-call webhook
   * Appelé après chaque appel pour sauvegarder analytics et transcription
   */
  app.post(
    '/post-call-webhook',
    {
      schema: {
        tags: ['twilio'],
        summary: 'Post-call webhook',
        description: 'Receives call analytics and transcription after call ends',
      },
    },
    async (request) => {
      const body = request.body as {
        call_sid: string;
        call_duration_seconds: number;
        transcript?: string;
        metadata?: Record<string, unknown>;
      };

      logger.info('Post-call webhook received', {
        callSid: body.call_sid,
        duration: body.call_duration_seconds,
      });

      try {
        // TODO: Traiter la transcription complète
        // - Analyser la qualité de l'appel
        // - Extraire insights médicaux
        // - Sauvegarder analytics
        // - Générer rapport de triage final

        logger.info('Post-call processing completed', {
          callSid: body.call_sid,
        });

        return { success: true };
      } catch (error) {
        logger.error('Post-call processing failed', error as Error);
        return { success: false, error: 'Processing failed' };
      }
    }
  );
};
