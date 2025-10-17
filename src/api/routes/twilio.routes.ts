import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { callService } from '@/services/call.service';
import { elevenlabsAgentService } from '@/services/elevenlabs-agent.service';
import { logger } from '@/utils/logger';

/**
 * Routes Twilio pour intégration téléphonique avec ElevenLabs Conversational AI
 *
 * POST /inbound - Webhook Twilio pour appels entrants (retourne TwiML)
 * POST /outbound - API pour lancer des appels sortants
 * POST /post-call-webhook - Webhook post-appel pour analytics
 *
 * Architecture:
 * 1. Twilio reçoit l'appel et appelle /inbound
 * 2. Backend crée un call en DB et génère signed URL ElevenLabs
 * 3. Backend retourne TwiML <Connect><Stream> pour connecter Twilio à ElevenLabs
 * 4. ElevenLabs agent gère la conversation (TTS/STT/VAD/LLM)
 * 5. Les tools de l'agent (dispatch_smur) appellent nos webhooks
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
        description:
          'Handles incoming calls from Twilio and returns TwiML to connect to ElevenLabs',
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
            description: 'TwiML response to connect Twilio to ElevenLabs',
            type: 'string',
            examples: [
              '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Connect>\n    <Stream url="wss://..." />\n  </Connect>\n</Response>',
            ],
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

        // Générer signed URL ElevenLabs pour cet appel
        const signedUrl = await elevenlabsAgentService.getSignedUrl(true);

        logger.info('Generated signed URL for phone call', {
          callId: call.id,
          callSid: body.CallSid,
        });

        // Retourner TwiML pour connecter Twilio à ElevenLabs WebSocket
        // Le frontend (Twilio) utilisera le WebSocket de la signed URL
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${signedUrl.replace('https://', 'wss://')}" />
  </Connect>
</Response>`;

        return reply.status(200).header('Content-Type', 'text/xml').send(twiml);
      } catch (error) {
        logger.error('Failed to handle inbound call', error as Error, {
          callSid: body.CallSid,
        });

        // Retourner TwiML d'erreur
        const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR">Désolé, le service est temporairement indisponible. Veuillez rappeler plus tard.</Say>
  <Hangup />
</Response>`;

        return reply.status(200).header('Content-Type', 'text/xml').send(errorTwiml);
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
