import { FastifyInstance } from 'fastify';
import { queueService } from '@/services/queue.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { PriorityLevel, QueueStatus } from '@prisma/client';

/**
 * Queue Routes
 * Routes pour gérer la file d'attente des appels (Dashboard opérateurs)
 */

// Validation schemas
const claimQueueEntrySchema = z.object({
  operatorId: z.string().cuid(),
});

export const queueRoutes = (app: FastifyInstance) => {
  /**
   * Liste de la queue
   * GET /api/v1/queue
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['queue'],
        summary: 'List queue entries',
        description: 'Get all queue entries with optional filters',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['WAITING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
              description: 'Filter by queue status',
            },
            priority: {
              type: 'string',
              enum: ['P0', 'P1', 'P2', 'P3'],
              description: 'Filter by priority level',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    callId: { type: 'string' },
                    priority: { type: 'string' },
                    chiefComplaint: { type: 'string' },
                    patientAge: { type: 'number' },
                    patientGender: { type: 'string' },
                    location: { type: 'string' },
                    aiSummary: { type: 'string' },
                    aiRecommendation: { type: 'string' },
                    keySymptoms: { type: 'array', items: { type: 'string' } },
                    redFlags: { type: 'array', items: { type: 'string' } },
                    status: { type: 'string' },
                    waitingSince: { type: 'string', format: 'date-time' },
                    claimedBy: { type: 'string' },
                    claimedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as {
          status?: QueueStatus;
          priority?: PriorityLevel;
        };

        logger.info('Listing queue entries', { filters: query });

        const queueEntries = await queueService.listQueue(query);

        return {
          success: true,
          data: queueEntries,
        };
      } catch (error) {
        logger.error('Failed to list queue entries', error as Error);
        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to list queue entries',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Statistiques de la queue
   * GET /api/v1/queue/stats
   */
  app.get(
    '/stats',
    {
      schema: {
        tags: ['queue'],
        summary: 'Get queue statistics',
        description: 'Get queue statistics (count by status, average wait time, etc.)',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  byStatus: {
                    type: 'object',
                    properties: {
                      waiting: { type: 'number' },
                      claimed: { type: 'number' },
                      inProgress: { type: 'number' },
                      completed: { type: 'number' },
                      abandoned: { type: 'number' },
                    },
                  },
                  avgWaitTimeSeconds: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        logger.info('Getting queue statistics');

        const stats = await queueService.getQueueStats();

        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        logger.error('Failed to get queue statistics', error as Error);
        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to get queue statistics',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Claim un appel de la queue
   * POST /api/v1/queue/:queueEntryId/claim
   */
  app.post(
    '/:queueEntryId/claim',
    {
      schema: {
        tags: ['queue'],
        summary: 'Claim queue entry',
        description: 'Claim a queue entry (operator takes the call)',
        params: {
          type: 'object',
          required: ['queueEntryId'],
          properties: {
            queueEntryId: { type: 'string', description: 'Queue entry ID' },
          },
        },
        body: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: { type: 'string', description: 'Operator ID claiming the call' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  callId: { type: 'string' },
                  status: { type: 'string' },
                  claimedBy: { type: 'string' },
                  claimedAt: { type: 'string', format: 'date-time' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { queueEntryId } = request.params as { queueEntryId: string };
        const body = claimQueueEntrySchema.parse(request.body);

        logger.info('Claiming queue entry', {
          queueEntryId,
          operatorId: body.operatorId,
        });

        const queueEntry = await queueService.claimQueueEntry({
          queueEntryId,
          operatorId: body.operatorId,
        });

        return {
          success: true,
          data: queueEntry,
          message: 'Queue entry claimed successfully',
        };
      } catch (error) {
        logger.error('Failed to claim queue entry', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Failed to claim queue entry',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Mettre à jour le statut d'une queue entry
   * PATCH /api/v1/queue/:queueEntryId/status
   */
  app.patch(
    '/:queueEntryId/status',
    {
      schema: {
        tags: ['queue'],
        summary: 'Update queue entry status',
        description: 'Update queue entry status',
        params: {
          type: 'object',
          required: ['queueEntryId'],
          properties: {
            queueEntryId: { type: 'string', description: 'Queue entry ID' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['WAITING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
              description: 'New status',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { queueEntryId } = request.params as { queueEntryId: string };
        const { status } = request.body as { status: QueueStatus };

        logger.info('Updating queue entry status', { queueEntryId, status });

        const queueEntry = await queueService.updateQueueStatus(queueEntryId, status);

        return {
          success: true,
          data: queueEntry,
          message: 'Queue entry status updated successfully',
        };
      } catch (error) {
        logger.error('Failed to update queue entry status', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Failed to update queue entry status',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Récupérer une queue entry par ID
   * GET /api/v1/queue/:queueEntryId
   */
  app.get(
    '/:queueEntryId',
    {
      schema: {
        tags: ['queue'],
        summary: 'Get queue entry by ID',
        description: 'Get a specific queue entry with all details',
        params: {
          type: 'object',
          required: ['queueEntryId'],
          properties: {
            queueEntryId: { type: 'string', description: 'Queue entry ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  callId: { type: 'string' },
                  priority: { type: 'string' },
                  chiefComplaint: { type: 'string' },
                  aiSummary: { type: 'string' },
                  aiRecommendation: { type: 'string' },
                  status: { type: 'string' },
                  waitingSince: { type: 'string', format: 'date-time' },
                  call: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { queueEntryId } = request.params as { queueEntryId: string };

        logger.info('Getting queue entry', { queueEntryId });

        const queueEntry = await queueService.getQueueEntryById(queueEntryId);

        return {
          success: true,
          data: queueEntry,
        };
      } catch (error) {
        logger.error('Failed to get queue entry', error as Error);
        return reply.status(404 as 200).send({
          success: false,
          error: 'Queue entry not found',
          message: (error as Error).message,
        });
      }
    }
  );
};
