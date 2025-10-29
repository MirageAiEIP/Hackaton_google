import { FastifyInstance } from 'fastify';
import { handoffService } from '@/services/handoff.service';
import { twilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';
import { logger } from '@/utils/logger';

export const handoffRoutes = (app: FastifyInstance) => {
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

  app.post(
    '/take-control',
    {
      schema: {
        tags: ['handoff'],
        summary: 'Operator takes control of active call',
        description: 'Operator initiates takeover of an ongoing AI conversation',
        body: {
          type: 'object',
          required: ['callId', 'operatorId'],
          properties: {
            callId: { type: 'string', description: 'ID of the call to take over' },
            operatorId: { type: 'string', description: 'ID of the operator taking control' },
            reason: { type: 'string', description: 'Reason for takeover (optional)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              handoffId: { type: 'string' },
              message: { type: 'string' },
              aiTerminated: { type: 'boolean', description: 'Whether AI session was terminated' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { callId, operatorId, reason } = request.body as {
          callId: string;
          operatorId: string;
          reason?: string;
        };

        logger.info('Operator taking control of call', {
          callId,
          operatorId: operatorId.substring(0, 8) + '***',
          reason,
        });

        // 1. Create handoff record in database
        const result = await handoffService.takeControl({
          callId,
          operatorId,
          reason,
        });

        // 2. Find and terminate the active AI session (but keep client connected)
        const sessionId = twilioElevenLabsProxyService.findSessionByCallId(callId);
        let aiTerminated = false;

        if (sessionId) {
          // terminate AI but keep client WebSocket open for operator connection
          aiTerminated = twilioElevenLabsProxyService.terminateWebSession(
            sessionId,
            reason || 'Prise de contrôle opérateur',
            false // Ne PAS fermer le client, juste l'AI
          );
          logger.info('AI terminated for operator takeover (client kept connected)', {
            callId,
            sessionId,
            aiTerminated,
          });
        } else {
          logger.warn('No active AI session found for call', { callId });
        }

        return reply.send({
          success: true,
          handoffId: result.handoff.id,
          sessionId, // Return sessionId for operator to connect
          message: 'Control taken successfully',
          aiTerminated,
          conversationContext: result.conversationContext,
        });
      } catch (error) {
        logger.error('Failed to take control of call', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Failed to take control',
          message: (error as Error).message,
        });
      }
    }
  );
};
