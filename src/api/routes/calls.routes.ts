/**
 * @fileoverview Call Management API Routes
 *
 * Provides REST endpoints for managing emergency call records:
 * - List and filter calls (GET /)
 * - Delete calls and related data (DELETE /:callId)
 * - Retrieve call transcripts (GET /:callId/transcript)
 * - Start web-based triage conversations (POST /start-web)
 * - AI-powered information extraction from transcripts (POST /:callId/extract-info)
 * - Preview extraction results without updating (POST /:callId/preview-extraction)
 *
 * All routes are prefixed with /api/v1/calls
 *
 * @module api/routes/calls
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { callService } from '@/services/call.service';
import { callInfoExtractionService } from '@/services/call-info-extraction.service';
import { logger } from '@/utils/logger';

// Store des conversations actives en mmoire
const activeConversations = new Map<
  string,
  {
    callId: string;
    startedAt: Date;
    signedUrl: string;
  }
>();

export const callsRoutes: FastifyPluginAsync = async (app) => {
  logger.info('Registering Calls Routes at /api/v1/calls');

  app.get(
    '/',
    {
      schema: {
        tags: ['calls'],
        summary: 'List all calls',
        description: 'Get all calls with pagination and optional status filter',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'CANCELLED'],
              description: 'Filter by call status',
            },
            limit: {
              type: 'number',
              default: 50,
              description: 'Number of calls to return',
            },
            offset: {
              type: 'number',
              default: 0,
              description: 'Number of calls to skip',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        status?: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED' | 'CANCELLED';
        limit?: number;
        offset?: number;
      };

      try {
        const calls = await callService.listCalls({
          status: query.status,
          limit: query.limit || 50,
          offset: query.offset || 0,
        });

        return {
          success: true,
          data: {
            calls,
            count: calls.length,
            limit: query.limit || 50,
            offset: query.offset || 0,
          },
        };
      } catch (error) {
        logger.error('Failed to list calls', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to list calls',
        });
      }
    }
  );

  app.delete(
    '/:callId',
    {
      schema: {
        tags: ['calls'],
        summary: 'Delete a call',
        description: 'Delete a call and all associated data (symptoms, triage report, etc.)',
        params: {
          type: 'object',
          properties: {
            callId: { type: 'string' },
          },
          required: ['callId'],
        },
      },
    },
    async (request, reply) => {
      const { callId } = request.params as { callId: string };

      try {
        await callService.deleteCall(callId);

        return {
          success: true,
          message: `Call ${callId} deleted successfully`,
        };
      } catch (error) {
        logger.error('Failed to delete call', error as Error, { callId });

        // Check if call was not found
        if ((error as Error).message.includes('Record to delete does not exist')) {
          return reply.status(404).send({
            success: false,
            error: 'Call not found',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to delete call',
        });
      }
    }
  );

  app.get(
    '/:callId/transcript',
    {
      schema: {
        tags: ['calls'],
        summary: 'Get call transcript',
        params: {
          type: 'object',
          properties: {
            callId: { type: 'string' },
          },
          required: ['callId'],
        },
      },
    },
    async (request, reply) => {
      const { callId } = request.params as { callId: string };

      try {
        const call = await callService.getCallById(callId);

        if (!call) {
          return reply.status(404).send({
            success: false,
            error: 'Call not found',
          });
        }

        return {
          success: true,
          data: {
            callId: call.id,
            transcript: call.transcript || '',
            status: call.status,
            createdAt: call.createdAt,
          },
        };
      } catch (error) {
        logger.error('Failed to get transcript', error as Error, { callId });
        return reply.status(500).send({
          success: false,
          error: 'Failed to get transcript',
        });
      }
    }
  );

  app.post(
    '/start-web',
    {
      schema: {
        tags: ['calls'],
        summary: 'Dmarrer conversation web',
        description: "Lance une nouvelle conversation avec l'agent SAMU (backend gre tout)",
        body: {
          type: 'object',
          properties: {
            phoneNumber: {
              type: 'string',
              description: 'Numro de tlphone du patient (optionnel)',
            },
            metadata: {
              type: 'object',
              description: 'Mtadonnes additionnelles (optionnel)',
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
                  wsUrl: {
                    type: 'string',
                    description: 'WebSocket URL vers notre backend (pas ElevenLabs directement)',
                  },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      logger.info('POST /api/v1/calls/start-web called');

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
        // 1. Crer l'appel en DB
        const call = await callService.createCall({
          phoneNumber: body.phoneNumber || 'WEB_CALL',
        });

        logger.info('Call created', { callId: call.id });

        // 2. Gnrer un sessionId unique
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 3. Stocker la conversation active
        activeConversations.set(sessionId, {
          callId: call.id,
          startedAt: new Date(),
          signedUrl: '', // Will be generated by WebSocket proxy
        });

        logger.info('Conversation initialized', {
          callId: call.id,
          sessionId,
        });

        if (!process.env.PUBLIC_API_URL) {
          throw new Error('PUBLIC_API_URL environment variable is not set');
        }

        const wsUrl = process.env.PUBLIC_API_URL.replace('https://', 'wss://').replace(
          'http://',
          'ws://'
        );

        return {
          success: true,
          callId: call.id,
          sessionId,
          agentConfig: {
            connectionType: 'websocket',
            wsUrl: `${wsUrl}/ws/web-conversation?sessionId=${sessionId}&callId=${call.id}`,
          },
          message: 'Conversation dmarre avec succs',
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

  app.post(
    '/:callId/extract-info',
    {
      schema: {
        tags: ['calls'],
        summary: 'Extract call info from transcript',
        description: 'Uses Gemini AI to automatically extract structured info from transcript',
        params: {
          type: 'object',
          properties: {
            callId: { type: 'string' },
          },
          required: ['callId'],
        },
      },
    },
    async (request, reply) => {
      const { callId } = request.params as { callId: string };

      logger.info('Manual call info extraction requested', { callId });

      try {
        const call = await callService.getCallById(callId);

        if (!call) {
          return reply.code(404).send({
            success: false,
            error: 'NOT_FOUND',
            message: `Call ${callId} not found`,
          });
        }

        if (!call.transcript) {
          return reply.code(400).send({
            success: false,
            error: 'NO_TRANSCRIPT',
            message: 'Call has no transcript to extract from',
          });
        }

        const result = await callInfoExtractionService.extractAndUpdateCall({
          callId,
          transcript: call.transcript,
        });

        return reply.send({
          success: true,
          message: `Successfully extracted and updated ${result.updated.length} fields`,
          data: {
            callId,
            updated: result.updated,
          },
        });
      } catch (error) {
        logger.error('Call info extraction failed', error as Error, { callId });
        return reply.code(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: (error as Error).message,
        });
      }
    }
  );

  app.post(
    '/:callId/preview-extraction',
    {
      schema: {
        tags: ['calls'],
        summary: 'Preview call info extraction',
        description: 'Extract info from transcript without updating the call',
        params: {
          type: 'object',
          properties: {
            callId: { type: 'string' },
          },
          required: ['callId'],
        },
      },
    },
    async (request, reply) => {
      const { callId } = request.params as { callId: string };

      logger.info('Preview extraction requested', { callId });

      try {
        const call = await callService.getCallById(callId);

        if (!call) {
          return reply.code(404).send({
            success: false,
            error: 'NOT_FOUND',
            message: `Call ${callId} not found`,
          });
        }

        if (!call.transcript) {
          return reply.code(400).send({
            success: false,
            error: 'NO_TRANSCRIPT',
            message: 'Call has no transcript',
          });
        }

        const result = await callInfoExtractionService.extractCallInfo({
          callId,
          transcript: call.transcript,
        });

        return reply.send({
          success: true,
          message: 'Extraction preview completed',
          data: {
            callId,
            extracted: result.extracted,
            fieldsCount: Object.keys(result.extracted).length,
          },
        });
      } catch (error) {
        logger.error('Preview extraction failed', error as Error, { callId });
        return reply.code(500).send({
          success: false,
          error: 'INTERNAL_ERROR',
          message: (error as Error).message,
        });
      }
    }
  );
};
