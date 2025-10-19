import { FastifyInstance } from 'fastify';
import { getElevenLabsConversationsService } from '@/services/elevenlabs-conversations.service';
import { dispatchService } from '@/services/dispatch.service';
import { queueService } from '@/services/queue.service';
import { handoffService } from '@/services/handoff.service';
import { callService } from '@/services/call.service';
import { twilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';
import { logger } from '@/utils/logger';
import {
  dispatchSmurBodySchema,
  queueQuerySchema,
  queueClaimParamSchema,
  queueClaimBodySchema,
  handoffRequestBodySchema,
  handoffAcceptParamSchema,
  takeControlParamSchema,
  takeControlBodySchema,
  mapInterventionsQuerySchema,
} from '@/api/validation/test.validation';

/**
 * Routes de test pour développement
 */
export const registerTestRoutes = (app: FastifyInstance) => {
  /**
   * Health check pour le frontend
   */
  app.get(
    '/health',
    {
      schema: {
        tags: ['test'],
        summary: 'Health check',
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    }
  );

  /**
   * Dispatch SMUR - Appelé par l'agent ElevenLabs via Client Tool
   * Endpoint pour déclencher les secours d'urgence
   */
  app.post(
    '/dispatch-smur',
    {
      schema: {
        tags: ['test'],
        summary: 'Dispatch SMUR',
        description: 'Déclenche le dispatch des secours SMUR (P0/P1)',
        body: {
          type: 'object',
          required: ['priority', 'location', 'reason'],
          properties: {
            priority: {
              type: 'string',
              enum: ['P0', 'P1', 'P2'],
              description: "Priorité de l'urgence",
            },
            location: {
              type: 'string',
              description: 'Adresse du patient',
            },
            reason: {
              type: 'string',
              description: "Symptômes / raison de l'urgence",
            },
            patientPhone: {
              type: 'string',
              description: 'Numéro de téléphone du patient',
            },
            callId: {
              type: 'string',
              description: "ID de l'appel (optionnel)",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { priority, location, reason, patientPhone, callId } = dispatchSmurBodySchema.parse(
        request.body
      );

      try {
        const result = await dispatchService.createDispatch({
          priority,
          location,
          symptoms: reason,
          patientPhone,
          callId,
        });

        return {
          success: true,
          dispatchId: result.dispatch.dispatchId,
          id: result.dispatch.id,
          callId: result.callId,
          priority,
          eta: priority === 'P0' ? '5-10 min' : '10-20 min',
          message: `Secours SMUR en route vers ${location}`,
        };
      } catch (error) {
        logger.error('Failed to create dispatch', error as Error);
        reply.status(500);
        return {
          success: false,
          error: 'Failed to dispatch SMUR',
        };
      }
    }
  );

  /**
   * CONVERSATIONS ELEVENLABS - Liste des conversations
   */
  app.get(
    '/conversations',
    {
      schema: {
        tags: ['conversations'],
        summary: 'Liste conversations',
        description: 'Récupère toutes les conversations depuis ElevenLabs API',
        querystring: {
          type: 'object',
          properties: {
            agent_id: {
              type: 'string',
              description: 'Filtrer par agent ID',
            },
            cursor: {
              type: 'string',
              description: 'Cursor pour pagination',
            },
            page_size: {
              type: 'number',
              description: 'Nombre de résultats (1-100)',
            },
            call_successful: {
              type: 'string',
              enum: ['success', 'failure', 'unknown'],
              description: 'Filtrer par résultat',
            },
          },
        },
      },
    },
    async (request) => {
      const { agent_id, cursor, page_size, call_successful } = request.query as {
        agent_id?: string;
        cursor?: string;
        page_size?: number;
        call_successful?: 'success' | 'failure' | 'unknown';
      };

      try {
        const conversationsService = getElevenLabsConversationsService();
        const response = await conversationsService.listConversations({
          agentId: agent_id,
          cursor,
          pageSize: page_size,
          callSuccessful: call_successful,
        });

        return {
          success: true,
          count: response.conversations.length,
          conversations: response.conversations,
          has_more: response.has_more,
          next_cursor: response.next_cursor,
        };
      } catch (error) {
        logger.error('Failed to retrieve conversations', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * Détails d'une conversation
   */
  app.get(
    '/conversations/:conversationId',
    {
      schema: {
        tags: ['conversations'],
        summary: 'Détails conversation',
        description: "Récupère le transcript complet d'une conversation",
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: {
              type: 'string',
              description: 'ID de la conversation',
            },
          },
        },
      },
    },
    async (request) => {
      const { conversationId } = request.params as { conversationId: string };

      try {
        const conversationsService = getElevenLabsConversationsService();
        const details = await conversationsService.getConversationDetails(conversationId);

        // Formater le transcript
        const formattedTranscript = conversationsService.formatTranscript(details.transcript);

        return {
          success: true,
          conversation: {
            ...details,
            formattedTranscript,
          },
        };
      } catch (error) {
        logger.error('Failed to retrieve conversation details', error as Error, { conversationId });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * Audio d'une conversation
   */
  app.get(
    '/conversations/:conversationId/audio',
    {
      schema: {
        tags: ['conversations'],
        summary: 'Audio conversation',
        description: "Télécharge l'enregistrement audio en MP3",
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: {
              type: 'string',
              description: 'ID de la conversation',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };

      try {
        const conversationsService = getElevenLabsConversationsService();
        const audioBuffer = await conversationsService.getConversationAudio(conversationId);

        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Content-Length', audioBuffer.length);
        reply.header(
          'Content-Disposition',
          `attachment; filename="conversation-${conversationId}.mp3"`
        );
        return reply.send(audioBuffer);
      } catch (error) {
        logger.error('Failed to retrieve conversation audio', error as Error, { conversationId });
        reply.status(500);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * QUEUE MANAGEMENT - Liste des appels en attente pour opérateurs humains
   */
  app.get(
    '/queue',
    {
      schema: {
        tags: ['queue'],
        summary: 'Liste de la queue',
        description: 'Récupère tous les appels P2/P3/P4 en attente pour les opérateurs',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['WAITING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
              description: 'Filtrer par statut',
            },
            priority: {
              type: 'string',
              enum: ['P2', 'P3', 'P4', 'P5'],
              description: 'Filtrer par priorité',
            },
          },
        },
      },
    },
    async (request) => {
      const { status, priority } = queueQuerySchema.parse(request.query);

      try {
        const queueEntries = await queueService.listQueue({
          status,
          priority,
        });

        return {
          success: true,
          count: queueEntries.length,
          queue: queueEntries,
        };
      } catch (error) {
        logger.error('Failed to retrieve queue', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * CLAIM CALL - Opérateur prend un appel de la queue
   */
  app.post(
    '/queue/:id/claim',
    {
      schema: {
        tags: ['queue'],
        summary: 'Prendre un appel',
        description: 'Opérateur prend en charge un appel de la queue',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID de la queue entry',
            },
          },
        },
        body: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: {
              type: 'string',
              description: "ID de l'opérateur qui prend l'appel",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = queueClaimParamSchema.parse(request.params);
      const { operatorId } = queueClaimBodySchema.parse(request.body);

      try {
        const updatedEntry = await queueService.claimQueueEntry({
          queueEntryId: id,
          operatorId,
        });

        return {
          success: true,
          queueEntry: updatedEntry,
          message: 'Appel pris en charge avec succès',
        };
      } catch (error) {
        logger.error('Failed to claim queue entry', error as Error, { id, operatorId });

        if ((error as Error).message.includes('not found')) {
          reply.status(404);
        } else if ((error as Error).message.includes('already')) {
          reply.status(409);
        } else {
          reply.status(500);
        }

        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * HANDOFF REQUEST - Agent IA demande transfert vers humain
   */
  app.post(
    '/handoff/request',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Demander handoff',
        description: 'Agent IA demande un transfert vers un opérateur humain',
        body: {
          type: 'object',
          required: [
            'callId',
            'toOperatorId',
            'reason',
            'transcript',
            'aiContext',
            'patientSummary',
          ],
          properties: {
            callId: {
              type: 'string',
              description: "ID de l'appel",
            },
            toOperatorId: {
              type: 'string',
              description: "ID de l'opérateur cible",
            },
            reason: {
              type: 'string',
              description: 'Raison du handoff',
            },
            conversationId: {
              type: 'string',
              description: 'ID de conversation ElevenLabs',
            },
            transcript: {
              type: 'string',
              description: 'Transcript complet de la conversation',
            },
            aiContext: {
              type: 'object',
              description: 'Contexte AI (symptômes, analyse, etc.)',
            },
            patientSummary: {
              type: 'string',
              description: "Résumé patient pour l'opérateur",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        callId,
        toOperatorId,
        reason,
        conversationId,
        transcript,
        aiContext,
        patientSummary,
      } = handoffRequestBodySchema.parse(request.body);

      try {
        const handoff = await handoffService.requestHandoff({
          callId,
          toOperatorId,
          reason,
          conversationId,
          transcript,
          aiContext,
          patientSummary,
        });

        return {
          success: true,
          handoff,
          message: 'Handoff demandé avec succès',
        };
      } catch (error) {
        logger.error('Failed to request handoff', error as Error, { callId, toOperatorId });
        reply.status(500);
        return {
          success: false,
          error: 'Failed to request handoff',
        };
      }
    }
  );

  /**
   * HANDOFF ACCEPT - Opérateur accepte le handoff
   */
  app.put(
    '/handoff/:id/accept',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Accepter handoff',
        description: 'Opérateur accepte un handoff et prend le contrôle',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID du handoff',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = handoffAcceptParamSchema.parse(request.params);

      try {
        const updatedHandoff = await handoffService.acceptHandoff(id);

        return {
          success: true,
          handoff: updatedHandoff,
          message: 'Handoff accepté, contrôle transféré',
        };
      } catch (error) {
        logger.error('Failed to accept handoff', error as Error, { id });

        if ((error as Error).message.includes('not found')) {
          reply.status(404);
        } else if ((error as Error).message.includes('already')) {
          reply.status(409);
        } else {
          reply.status(500);
        }

        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * TAKE CONTROL - Opérateur prend directement le contrôle d'une conversation
   * Route simplifiée pour prise de contrôle instantanée depuis le dashboard
   */
  app.post(
    '/calls/:callId/take-control',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Prendre le contrôle',
        description: "Opérateur prend instantanément le contrôle d'une conversation en cours",
        params: {
          type: 'object',
          required: ['callId'],
          properties: {
            callId: {
              type: 'string',
              description: "ID de l'appel",
            },
          },
        },
        body: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: {
              type: 'string',
              description: "ID de l'opérateur qui prend le contrôle",
            },
            reason: {
              type: 'string',
              description: 'Raison de la prise de contrôle (optionnel)',
              default: 'Prise de contrôle manuelle',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { callId } = takeControlParamSchema.parse(request.params);
      const { operatorId, reason } = takeControlBodySchema.parse(request.body);

      try {
        const result = await handoffService.takeControl({
          callId,
          operatorId,
          reason,
        });

        return {
          success: true,
          handoffId: result.handoff.id,
          callId,
          operatorId,
          message: 'Contrôle pris avec succès',
          conversationContext: result.conversationContext,
        };
      } catch (error) {
        logger.error('Failed to take control', error as Error, { callId, operatorId });

        if ((error as Error).message.includes('not found')) {
          reply.status(404);
        } else if ((error as Error).message.includes('already')) {
          reply.status(409);
        } else {
          reply.status(500);
        }

        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * ACTIVE CALLS - Liste des conversations en cours
   */
  app.get(
    '/calls/active',
    {
      schema: {
        tags: ['calls'],
        summary: 'Conversations en cours',
        description: 'Liste toutes les conversations actives que les opérateurs peuvent reprendre',
      },
    },
    async () => {
      try {
        const activeCalls = await callService.getActiveCalls();

        return {
          success: true,
          count: activeCalls.length,
          calls: activeCalls,
        };
      } catch (error) {
        logger.error('Failed to retrieve active calls', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * ACTIVE SESSIONS - Liste des sessions WebSocket actives
   */
  app.get(
    '/active-sessions',
    {
      schema: {
        tags: ['calls'],
        summary: 'Sessions WebSocket actives',
        description: 'Liste toutes les sessions WebSocket actives (conversations web en cours)',
      },
    },
    async () => {
      try {
        const activeSessions = twilioElevenLabsProxyService.getActiveSessions();

        return {
          success: true,
          count: activeSessions.length,
          sessions: activeSessions,
        };
      } catch (error) {
        logger.error('Failed to retrieve active sessions', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * MAP DATA - Interventions pour visualisation carte
   */
  app.get(
    '/interventions/map',
    {
      schema: {
        tags: ['map'],
        summary: 'Données carte',
        description: 'Récupère toutes les interventions avec coordonnées pour affichage carte',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED'],
              description: 'Filtrer par statut',
            },
            priority: {
              type: 'string',
              enum: ['P0', 'P1', 'P2'],
              description: 'Filtrer par priorité',
            },
            last_hours: {
              type: 'number',
              description: 'Dernières N heures (défaut: 24)',
            },
          },
        },
      },
    },
    async (request) => {
      const { status, priority, last_hours } = mapInterventionsQuerySchema.parse(request.query);

      try {
        const result = await dispatchService.getMapDispatches({
          status,
          priority,
          lastHours: last_hours,
        });

        return {
          success: true,
          count: result.dispatches.length,
          dispatches: result.dispatches,
          geoJson: result.geoJson,
        };
      } catch (error) {
        logger.error('Failed to retrieve map data', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * GET ALL DISPATCHES - Liste de tous les dispatches
   */
  app.get(
    '/dispatches',
    {
      schema: {
        tags: ['dispatches'],
        summary: 'Liste des dispatches',
        description: 'Récupère tous les dispatches SMUR',
      },
    },
    async () => {
      try {
        const dispatches = await dispatchService.listDispatches();

        return {
          success: true,
          count: dispatches.length,
          dispatches,
        };
      } catch (error) {
        logger.error('Failed to retrieve dispatches', error as Error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );
};
