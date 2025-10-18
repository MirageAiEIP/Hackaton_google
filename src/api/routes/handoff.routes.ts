import { FastifyInstance } from 'fastify';
import { handoffService } from '@/services/handoff.service';
import { logger } from '@/utils/logger';

/**
 * Handoff Routes
 * Manage handoff requests between AI and human operators
 */
export const handoffRoutes = (app: FastifyInstance) => {
  /**
   * Get pending handoffs
   * GET /api/v1/handoff/pending
   */
  app.get(
    '/pending',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Get pending handoff requests',
        description: 'Returns list of handoff requests waiting for operator assignment',
      },
    },
    async (_request, reply) => {
      try {
        const pendingHandoffs = await handoffService.listHandoffs({ status: 'REQUESTED' });

        return reply.send({
          success: true,
          count: pendingHandoffs.length,
          data: pendingHandoffs,
        });
      } catch (error) {
        logger.error('Failed to get pending handoffs', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve pending handoffs',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Accept handoff
   * POST /api/v1/handoff/:handoffId/accept
   */
  app.post(
    '/:handoffId/accept',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Accept handoff request',
        description: 'Operator accepts a handoff and starts handling the call',
        params: {
          type: 'object',
          required: ['handoffId'],
          properties: {
            handoffId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { handoffId } = request.params as { handoffId: string };
        const { operatorId } = request.body as { operatorId: string };

        logger.info('Operator accepting handoff', {
          handoffId,
          operatorId: operatorId.substring(0, 8) + '***',
        });

        await handoffService.acceptHandoff(handoffId);

        return reply.send({
          success: true,
          message: 'Handoff accepted successfully',
        });
      } catch (error) {
        logger.error('Failed to accept handoff', error as Error);
        return reply.status(400).send({
          success: false,
          error: 'Failed to accept handoff',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Get handoff details
   * GET /api/v1/handoff/:handoffId
   */
  app.get(
    '/:handoffId',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Get handoff details',
        description: 'Retrieve full handoff information including transcript and context',
        params: {
          type: 'object',
          required: ['handoffId'],
          properties: {
            handoffId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { handoffId } = request.params as { handoffId: string };

        const handoff = await handoffService.getHandoffById(handoffId);

        if (!handoff) {
          return reply.status(404).send({
            success: false,
            error: 'Handoff not found',
          });
        }

        return reply.send({
          success: true,
          data: handoff,
        });
      } catch (error) {
        logger.error('Failed to get handoff details', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve handoff',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Complete handoff
   * POST /api/v1/handoff/:handoffId/complete
   */
  app.post(
    '/:handoffId/complete',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Complete handoff',
        description: 'Mark handoff as completed',
        params: {
          type: 'object',
          required: ['handoffId'],
          properties: {
            handoffId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { handoffId } = request.params as { handoffId: string };

        await handoffService.updateHandoffStatus(handoffId, 'COMPLETED');

        return reply.send({
          success: true,
          message: 'Handoff completed successfully',
        });
      } catch (error) {
        logger.error('Failed to complete handoff', error as Error);
        return reply.status(400).send({
          success: false,
          error: 'Failed to complete handoff',
          message: (error as Error).message,
        });
      }
    }
  );
};
