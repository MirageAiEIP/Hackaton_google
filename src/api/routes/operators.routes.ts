import { FastifyInstance } from 'fastify';
import { operatorService } from '@/services/operator.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { OperatorStatus } from '@/domain/operator/entities/Operator.entity';

/**
 * Operators Routes
 * Simple service-based architecture
 */

// Validation schemas
const createOperatorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    OperatorStatus.AVAILABLE,
    OperatorStatus.OFFLINE,
    OperatorStatus.BUSY,
    OperatorStatus.ON_BREAK,
  ]),
});

export const operatorsRoutes = (app: FastifyInstance) => {
  /**
   * Create operator
   * POST /api/v1/operators
   */
  app.post(
    '/',
    {
      schema: {
        tags: ['operators'],
        summary: 'Create operator',
        description: 'Create a new operator',
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { name, email } = createOperatorSchema.parse(request.body);
        const operator = await operatorService.createOperator({ name, email });

        return reply.code(201).send({
          success: true,
          data: { operator },
          message: 'Operator created successfully',
        });
      } catch (error) {
        logger.error('Failed to create operator', error as Error);
        return reply.code(400).send({
          success: false,
          error: {
            code: 'CREATE_OPERATOR_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  /**
   * Get all operators
   * GET /api/v1/operators
   */
  app.get(
    '/',
    {
      schema: {
        tags: ['operators'],
        summary: 'Get all operators',
        description: 'Returns list of all operators',
      },
    },
    async (_request, reply) => {
      try {
        const operators = await operatorService.listOperators();

        return reply.send({
          success: true,
          data: { operators },
        });
      } catch (error) {
        logger.error('Failed to get all operators', error as Error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'FETCH_OPERATORS_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  /**
   * Update operator status
   * PATCH /api/v1/operators/:operatorId/status
   */
  app.patch(
    '/:operatorId/status',
    {
      schema: {
        tags: ['operators'],
        summary: 'Update operator status',
        description: 'Update operator status (AVAILABLE/OFFLINE)',
        params: {
          type: 'object',
          required: ['operatorId'],
          properties: {
            operatorId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'OFFLINE', 'BUSY', 'ON_BREAK'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { operatorId } = request.params as { operatorId: string };
        const { status } = updateStatusSchema.parse(request.body);

        await operatorService.updateOperatorStatus({ operatorId, status });

        return reply.code(200).send({
          success: true,
          message: 'Operator status updated',
        });
      } catch (error) {
        logger.error('Failed to update operator status', error as Error);
        return reply.code(400).send({
          success: false,
          error: {
            code: 'UPDATE_STATUS_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  /**
   * Claim a call from queue
   * POST /api/v1/operators/:operatorId/claim/:queueEntryId
   */
  app.post(
    '/:operatorId/claim/:queueEntryId',
    {
      schema: {
        tags: ['operators'],
        summary: 'Claim call from queue',
        description: 'Operator claims a waiting call from the queue',
        params: {
          type: 'object',
          required: ['operatorId', 'queueEntryId'],
          properties: {
            operatorId: { type: 'string' },
            queueEntryId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { operatorId, queueEntryId } = request.params as {
          operatorId: string;
          queueEntryId: string;
        };

        await operatorService.claimCall({ operatorId, queueEntryId });

        return reply.code(200).send({
          success: true,
          message: 'Call claimed successfully',
        });
      } catch (error) {
        logger.error('Failed to claim call', error as Error);
        return reply.code(400).send({
          success: false,
          error: {
            code: 'CLAIM_CALL_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  /**
   * Get available operators
   * GET /api/v1/operators/available
   */
  app.get(
    '/available',
    {
      schema: {
        tags: ['operators'],
        summary: 'Get available operators',
        description: 'Returns list of operators ready to claim calls',
      },
    },
    async (_request, reply) => {
      try {
        const operators = await operatorService.getAvailableOperators();

        return reply.send({
          success: true,
          data: { operators },
        });
      } catch (error) {
        logger.error('Failed to get available operators', error as Error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'FETCH_OPERATORS_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );
};
