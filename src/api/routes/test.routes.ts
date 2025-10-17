import { FastifyInstance } from 'fastify';
import { getElevenLabsTTSService } from '@/services/elevenlabs-tts-stream.service';
import { getElevenLabsConversationsService } from '@/services/elevenlabs-conversations.service';
import { dispatchService } from '@/services/dispatch.service';
import { queueService } from '@/services/queue.service';
import { handoffService } from '@/services/handoff.service';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';
import type { Prisma } from '@prisma/client';

/**
 * Routes de test pour développement
 */
export const registerTestRoutes = (app: FastifyInstance) => {
  /**
   * Test TTS - Convertit du texte en audio
   */
  app.post(
    '/tts',
    {
      schema: {
        tags: ['test'],
        summary: 'Test TTS',
        description: 'Test text-to-speech avec ElevenLabs',
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: {
              type: 'string',
              description: 'Texte à synthétiser',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { text } = request.body as { text: string };

      logger.info('Test TTS request', { text: text.substring(0, 50) + '...' });

      try {
        const ttsService = getElevenLabsTTSService();
        const { audioStream } = await ttsService.streamText(text);

        // Collecte tous les chunks audio
        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }

        const audioBuffer = Buffer.concat(chunks);

        logger.info('TTS generated', { size: audioBuffer.length });

        // Retourne l'audio en MP3
        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Content-Length', audioBuffer.length);
        return reply.send(audioBuffer);
      } catch (error) {
        logger.error('TTS test failed', error as Error);
        reply.status(500);
        return { error: 'TTS generation failed' };
      }
    }
  );

  /**
   * Test VAD - Analyse un fichier audio pour détecter la voix
   */
  app.post(
    '/vad',
    {
      schema: {
        tags: ['test'],
        summary: 'Test VAD',
        description: 'Test Voice Activity Detection',
      },
    },
    async () => {
      // TODO: Implémenter test VAD
      return { message: 'VAD test endpoint - TODO' };
    }
  );

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
        services: {
          tts: 'ready',
          vad: 'ready',
        },
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
              description: 'Priorité de l\'urgence',
            },
            location: {
              type: 'string',
              description: 'Adresse du patient',
            },
            reason: {
              type: 'string',
              description: 'Symptômes / raison de l\'urgence',
            },
            patientPhone: {
              type: 'string',
              description: 'Numéro de téléphone du patient',
            },
            callId: {
              type: 'string',
              description: 'ID de l\'appel (optionnel)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { priority, location, reason, patientPhone, callId } = request.body as {
        priority: 'P0' | 'P1' | 'P2';
        location: string;
        reason: string;
        patientPhone?: string;
        callId?: string;
      };

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
   * Analyse ABCD - Appelé par l'agent ElevenLabs via Client Tool
   * Analyse les symptômes et retourne la priorité calculée
   */
  app.post(
    '/analyze-abcd',
    {
      schema: {
        tags: ['test'],
        summary: 'Analyse ABCD',
        description: 'Analyse médicale ABCD pour classification de priorité',
        body: {
          type: 'object',
          required: ['symptoms'],
          properties: {
            symptoms: {
              type: 'object',
              description: 'Symptômes du patient',
            },
            abcdAssessment: {
              type: 'object',
              description: 'Évaluation ABCD complète',
            },
          },
        },
      },
    },
    async (request) => {
      const { symptoms, abcdAssessment } = request.body as {
        symptoms: Record<string, unknown>;
        abcdAssessment?: Record<string, unknown>;
      };

      logger.info('ABCD Analysis request', { symptoms, abcdAssessment });

      // TODO: Implémenter vraie analyse ABCD avec Claude/Gemini
      // - Analyser les symptômes
      // - Calculer le score ABCD
      // - Déterminer la priorité (P0-P5)
      // - Générer recommandations

      // Simulation basique pour le moment
      const priority = 'P1'; // À calculer avec l'IA
      const confidence = 0.85;
      const reasoning = 'Symptômes graves détectés: saignement important, traumatisme osseux';
      const shouldEscalate = true;
      const recommendation = 'Dispatch SMUR immédiat recommandé';

      logger.info('ABCD Analysis result', { priority, confidence });

      return {
        success: true,
        priority,
        confidence,
        reasoning,
        shouldEscalate,
        recommendation,
      };
    }
  );

  /**
   * Enregistrement des données - Appelé par l'agent ElevenLabs via Client Tool
   * Sauvegarde le transcript et les notes de l'appel
   */
  app.post(
    '/record-data',
    {
      schema: {
        tags: ['test'],
        summary: 'Enregistrement données',
        description: 'Enregistre les données de conversation et notes',
        body: {
          type: 'object',
          properties: {
            transcript: {
              type: 'string',
              description: 'Transcription de la conversation',
            },
            notes: {
              type: 'string',
              description: 'Notes médicales',
            },
          },
        },
      },
    },
    async (request) => {
      const { transcript, notes } = request.body as {
        transcript?: string;
        notes?: string;
      };

      logger.info('Recording call data', {
        transcriptLength: transcript?.length || 0,
        notesLength: notes?.length || 0,
      });

      // TODO: Enregistrer dans la DB
      // - Table Call (transcription complète)
      // - Table AuditLog (compliance GDPR)
      // - Générer rapport de triage final

      const recordId = `RECORD-${Date.now()}`;

      logger.info('Data recorded', { recordId });

      return {
        success: true,
        recordId,
        message: 'Données enregistrées avec succès',
      };
    }
  );

  /**
   * Sauvegarde complète de conversation - Appelé à la fin de chaque session
   * Stocke toutes les données: transcript, tool calls, metadata
   */
  app.post(
    '/save-conversation',
    {
      schema: {
        tags: ['test'],
        summary: 'Sauvegarder conversation complète',
        description: 'Enregistre toutes les données d\'une conversation ElevenLabs (transcript, tool calls, metadata)',
        body: {
          type: 'object',
          required: ['conversationId', 'transcript'],
          properties: {
            conversationId: {
              type: 'string',
              description: 'ID unique de la conversation',
            },
            agentId: {
              type: 'string',
              description: 'ID de l\'agent ElevenLabs',
            },
            startTime: {
              type: 'string',
              description: 'Timestamp de début (ISO 8601)',
            },
            endTime: {
              type: 'string',
              description: 'Timestamp de fin (ISO 8601)',
            },
            transcript: {
              type: 'array',
              description: 'Transcription complète de la conversation',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'agent'] },
                  message: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
            toolCalls: {
              type: 'array',
              description: 'Appels de Client Tools effectués',
              items: {
                type: 'object',
                properties: {
                  toolName: { type: 'string' },
                  timestamp: { type: 'string' },
                  parameters: { type: 'object' },
                  result: { type: 'object' },
                  success: { type: 'boolean' },
                },
              },
            },
            metadata: {
              type: 'object',
              description: 'Métadonnées supplémentaires',
            },
          },
        },
      },
    },
    async (request) => {
      const conversationData = request.body as {
        conversationId: string;
        agentId?: string;
        startTime?: string;
        endTime?: string;
        transcript: Array<{
          role: 'user' | 'agent';
          message: string;
          timestamp: string;
        }>;
        toolCalls?: Array<{
          toolName: string;
          timestamp: string;
          parameters: Record<string, unknown>;
          result?: Record<string, unknown>;
          success: boolean;
        }>;
        metadata?: Record<string, unknown>;
      };

      logger.info('SAVE CONVERSATION REQUEST', {
        conversationId: conversationData.conversationId,
        transcriptLength: conversationData.transcript.length,
        toolCallsCount: conversationData.toolCalls?.length || 0,
        duration: conversationData.metadata?.durationSeconds,
      });

      // Log complet des données reçues
      logger.info('Conversation details', {
        agentId: conversationData.agentId,
        startTime: conversationData.startTime,
        endTime: conversationData.endTime,
        transcript: conversationData.transcript.map((t) => `${t.role}: ${t.message.substring(0, 50)}...`),
        toolCalls: conversationData.toolCalls?.map((tc) => ({
          tool: tc.toolName,
          success: tc.success,
          params: Object.keys(tc.parameters),
        })),
      });

      // TODO: Implémenter la vraie persistence en DB
      // - Créer/Update Call dans la DB
      // - Stocker transcript complet
      // - Enregistrer les tool calls (dispatches)
      // - Sauvegarder metadata pour analytics
      // - Créer AuditLog pour compliance

      const savedId = `CONV-${Date.now()}`;

      logger.info('Conversation saved to database', {
        id: savedId,
        conversationId: conversationData.conversationId,
      });

      return {
        success: true,
        id: savedId,
        conversationId: conversationData.conversationId,
        stats: {
          messages: conversationData.transcript.length,
          toolCalls: conversationData.toolCalls?.length || 0,
          duration: conversationData.metadata?.durationSeconds || 0,
        },
        message: 'Conversation sauvegardée avec succès',
      };
    }
  );

  /**
   * Liste toutes les conversations ElevenLabs (avec pagination)
   */
  app.get(
    '/conversations',
    {
      schema: {
        tags: ['test'],
        summary: 'Liste des conversations',
        description: 'Récupère la liste des conversations depuis l\'API ElevenLabs avec pagination',
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
              minimum: 1,
              maximum: 100,
              description: 'Nombre de résultats (1-100, défaut 30)',
            },
            call_successful: {
              type: 'string',
              enum: ['success', 'failure', 'unknown'],
              description: 'Filtrer par résultat de l\'appel',
            },
            get_all: {
              type: 'boolean',
              description: 'Récupérer toutes les conversations (toutes pages)',
            },
          },
        },
      },
    },
    async (request) => {
      const {
        agent_id,
        cursor,
        page_size,
        call_successful,
        get_all,
      } = request.query as {
        agent_id?: string;
        cursor?: string;
        page_size?: number;
        call_successful?: 'success' | 'failure' | 'unknown';
        get_all?: boolean;
      };

      try {
        const conversationsService = getElevenLabsConversationsService();

        // Si get_all=true, récupérer toutes les pages
        if (get_all) {
          const allConversations = await conversationsService.getAllConversations({
            agentId: agent_id,
            callSuccessful: call_successful,
            pageSize: page_size,
          });

          logger.info('All conversations retrieved', { count: allConversations.length });

          return {
            success: true,
            count: allConversations.length,
            conversations: allConversations,
          };
        }

        // Sinon, récupérer une seule page
        const response = await conversationsService.listConversations({
          agentId: agent_id,
          cursor,
          pageSize: page_size,
          callSuccessful: call_successful,
        });

        logger.info('Conversations retrieved', {
          count: response.conversations.length,
          hasMore: response.has_more,
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
   * Récupère les détails d'une conversation spécifique
   */
  app.get(
    '/conversations/:conversationId',
    {
      schema: {
        tags: ['test'],
        summary: 'Détails d\'une conversation',
        description: 'Récupère le transcript complet et metadata d\'une conversation',
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

        // Extraire les tool calls
        const toolCalls = conversationsService.extractToolCalls(details.transcript);

        logger.info('Conversation details retrieved', {
          conversationId,
          transcriptLength: details.transcript.length,
          toolCallsCount: toolCalls.length,
        });

        return {
          success: true,
          conversation: {
            ...details,
            formattedTranscript,
            toolCalls,
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
   * Endpoint de diagnostic - Retourne les détails bruts de l'API ElevenLabs
   */
  app.get(
    '/conversations/:conversationId/raw',
    {
      schema: {
        tags: ['test'],
        summary: 'Détails bruts (diagnostic)',
        description: 'Retourne la réponse brute de l\'API ElevenLabs pour diagnostic',
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

        // Log les tool calls détectés
        const toolCalls = conversationsService.extractToolCalls(details.transcript);

        logger.info('RAW DIAGNOSTIC', {
          conversationId,
          transcriptLength: details.transcript.length,
          toolCallsExtracted: toolCalls.length,
          rawToolCalls: toolCalls,
        });

        // Retourner les détails bruts
        return {
          success: true,
          conversationId,
          raw: details,
          extracted: {
            toolCalls,
            transcriptLength: details.transcript.length,
          },
        };
      } catch (error) {
        logger.error('Failed to retrieve raw conversation details', error as Error, { conversationId });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  /**
   * Télécharge l'audio d'une conversation
   */
  app.get(
    '/conversations/:conversationId/audio',
    {
      schema: {
        tags: ['test'],
        summary: 'Audio de conversation',
        description: 'Télécharge l\'enregistrement audio complet en MP3',
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

        logger.info('Conversation audio retrieved', {
          conversationId,
          size: audioBuffer.length,
        });

        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Content-Length', audioBuffer.length);
        reply.header('Content-Disposition', `attachment; filename="conversation-${conversationId}.mp3"`);
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
      const { status, priority } = request.query as {
        status?: string;
        priority?: string;
      };

      try {
        const queueEntries = await queueService.listQueue({
          status: status as any,
          priority: priority as any,
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
              description: 'ID de l\'opérateur qui prend l\'appel',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { operatorId } = request.body as { operatorId: string };

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
          required: ['callId', 'toOperatorId', 'reason', 'transcript', 'aiContext', 'patientSummary'],
          properties: {
            callId: {
              type: 'string',
              description: 'ID de l\'appel',
            },
            toOperatorId: {
              type: 'string',
              description: 'ID de l\'opérateur cible',
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
              description: 'Résumé patient pour l\'opérateur',
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
      } = request.body as {
        callId: string;
        toOperatorId: string;
        reason: string;
        conversationId?: string;
        transcript: string;
        aiContext: Prisma.InputJsonValue;
        patientSummary: string;
      };

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
      const { id } = request.params as { id: string };

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
        description: 'Opérateur prend instantanément le contrôle d\'une conversation en cours',
        params: {
          type: 'object',
          required: ['callId'],
          properties: {
            callId: {
              type: 'string',
              description: 'ID de l\'appel',
            },
          },
        },
        body: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: {
              type: 'string',
              description: 'ID de l\'opérateur qui prend le contrôle',
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
      const { callId } = request.params as { callId: string };
      const { operatorId, reason } = request.body as {
        operatorId: string;
        reason?: string;
      };

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
      const { status, priority, last_hours } = request.query as {
        status?: string;
        priority?: string;
        last_hours?: number;
      };

      try {
        const result = await dispatchService.getMapDispatches({
          status: status as any,
          priority: priority as any,
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
