import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { callService } from '@/services/call.service';
import { elevenlabsAgentService } from '@/services/elevenlabs-agent.service';
import { logger } from '@/utils/logger';

/**
 * Routes pour gérer les conversations web
 * Le frontend appelle ces routes, le backend gère tout
 * Architecture: Signed URL - Le frontend se connecte directement à ElevenLabs
 */

// Store des conversations actives en mémoire
const activeConversations = new Map<
  string,
  {
    callId: string;
    startedAt: Date;
    signedUrl: string;
  }
>();

export const callsRoutes = (app: FastifyInstance) => {
  /**
   * Démarrer une nouvelle conversation web
   * Le frontend appelle cette route, le backend gère tout
   */
  app.post(
    '/start-web',
    {
      schema: {
        tags: ['calls'],
        summary: 'Démarrer conversation web',
        description: "Lance une nouvelle conversation avec l'agent SAMU (backend gère tout)",
        body: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'Numéro de téléphone du patient (optionnel)',
            },
            metadata: {
              type: 'object',
              description: 'Métadonnées additionnelles (optionnel)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              callId: { type: 'string' },
              sessionId: { type: 'string' },
              agentConfig: {
                type: 'object',
                properties: {
                  connectionType: { type: 'string' },
                  signedUrl: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z.object({
        phoneNumber: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      });

      const body = bodySchema.parse(request.body);

      logger.info('Starting web conversation', {
        phoneNumber: body.phoneNumber,
        hasMetadata: !!body.metadata,
      });

      try {
        // 1. Créer l'appel en DB
        const call = await callService.createCall({
          phoneNumber: body.phoneNumber || 'WEB_CALL',
        });

        logger.info('Call created', { callId: call.id });

        // 2. Générer une signed URL depuis ElevenLabs
        // La signed URL est valide 15 minutes et permet au frontend de se connecter directement
        const signedUrl = await elevenlabsAgentService.getSignedUrl(true);

        logger.info('Signed URL generated from ElevenLabs', {
          callId: call.id,
          urlLength: signedUrl.length,
        });

        // 3. Stocker la conversation active
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        activeConversations.set(sessionId, {
          callId: call.id,
          startedAt: new Date(),
          signedUrl,
        });

        logger.info('Conversation initialized', {
          callId: call.id,
          sessionId,
        });

        // 4. Retourner les infos au frontend
        // Frontend se connecte directement à ElevenLabs avec la signed URL
        return {
          success: true,
          callId: call.id,
          sessionId,
          agentConfig: {
            connectionType: 'websocket',
            signedUrl, // Frontend utilise cette URL pour se connecter à ElevenLabs
          },
          message: 'Conversation démarrée avec succès',
        };
      } catch (error) {
        logger.error('Failed to start web conversation', error as Error);
        reply.status(500 as 200).send({
          success: false,
          error: 'Failed to start conversation',
        });
        return;
      }
    }
  );

  /**
   * Obtenir le statut d'une conversation
   */
  app.get(
    '/:sessionId/status',
    {
      schema: {
        tags: ['calls'],
        summary: 'Statut de la conversation',
        description: "Récupère le statut d'une conversation en cours",
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      const activeConv = activeConversations.get(sessionId);

      if (!activeConv) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found',
        });
      }

      return {
        success: true,
        sessionId,
        callId: activeConv.callId,
        startedAt: activeConv.startedAt.toISOString(),
        duration: Math.floor((Date.now() - activeConv.startedAt.getTime()) / 1000),
        status: 'active',
      };
    }
  );

  /**
   * Terminer une conversation
   */
  app.post(
    '/:sessionId/stop',
    {
      schema: {
        tags: ['calls'],
        summary: 'Terminer la conversation',
        description: 'Arrête proprement une conversation en cours',
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      logger.info('Stopping conversation', { sessionId });

      const activeConv = activeConversations.get(sessionId);

      if (!activeConv) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found',
        });
      }

      try {
        // Arrêter la conversation ElevenLabs
        // await activeConv.conversation.endSession();

        // Mettre à jour le statut dans la DB
        await callService.updateCallStatus(activeConv.callId, 'COMPLETED');

        // Supprimer de la liste active
        activeConversations.delete(sessionId);

        logger.info('Conversation stopped', {
          sessionId,
          callId: activeConv.callId,
        });

        return {
          success: true,
          message: 'Conversation terminée avec succès',
        };
      } catch (error) {
        logger.error('Failed to stop conversation', error as Error, { sessionId });
        return reply.status(500).send({
          success: false,
          error: 'Failed to stop conversation',
        });
      }
    }
  );

  /**
   * NOTE: WebSocket route désactivée avec l'approche Signed URL
   * Le frontend se connecte directement à ElevenLabs avec la signed URL
   * Cette route n'est plus nécessaire car pas de proxy
   */

  // Décommenter cette route si on revient à l'approche 2 (Proxy WebSocket)
  /*
  app.get(
    '/:sessionId/stream',
    { websocket: true },
    async (connection, request) => {
      const { sessionId } = request.params as { sessionId: string };
      logger.info('WebSocket connection established', { sessionId });

      const activeConv = activeConversations.get(sessionId);
      if (!activeConv) {
        connection.send(JSON.stringify({
          type: 'error',
          message: 'Session not found',
        }));
        connection.close();
        return;
      }

      // Proxy entre frontend et ElevenLabs
      connection.on('message', async (message: Buffer) => {
        // Transférer vers ElevenLabs
      });

      connection.on('close', () => {
        logger.info('WebSocket connection closed', { sessionId });
      });
    }
  );
  */
};
