import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { audioMonitoringService } from '@/services/audio-monitoring.service';
import { logger } from '@/utils/logger';
import { z } from 'zod';

/**
 * Routes for real-time call monitoring
 *
 * WebSocket endpoints:
 * - /monitoring/twilio-stream/:callSid - Receives audio stream from Twilio
 * - /monitoring/listen/:callSid - Operators connect to listen to active calls
 *
 * REST endpoints:
 * - GET /monitoring/active-calls - List all calls available for monitoring
 * - GET /monitoring/stream-info/:callSid - Get stream information
 */
export const monitoringRoutes: FastifyPluginAsync = async (app) => {
  /**
   * WebSocket endpoint for Twilio audio stream
   * Twilio sends audio here when using bidirectional streaming
   */
  app.get('/twilio-stream/:callSid', { websocket: true }, async (connection, request) => {
    const { callSid } = request.params as { callSid: string };

    logger.info('Twilio stream WebSocket connection initiated', { callSid });

    // Register this Twilio connection
    audioMonitoringService.handleTwilioConnection(callSid, connection as unknown as WebSocket);
  });

  /**
   * WebSocket endpoint for operators to listen to active calls
   * Operators/dashboard connects here to monitor a call in real-time
   */
  app.get('/listen/:callSid', { websocket: true }, async (connection, request) => {
    const { callSid } = request.params as { callSid: string };
    const query = request.query as {
      operatorId?: string;
      includeInbound?: string;
      includeOutbound?: string;
    };

    const operatorId = query.operatorId || `operator_${Date.now()}`;
    const includeInbound = query.includeInbound !== 'false';
    const includeOutbound = query.includeOutbound !== 'false';

    logger.info('Operator monitoring connection initiated', {
      callSid,
      operatorId,
      includeInbound,
      includeOutbound,
    });

    // Add operator to monitoring
    const success = audioMonitoringService.addOperator(
      callSid,
      operatorId,
      connection as unknown as WebSocket,
      {
        includeInbound,
        includeOutbound,
      }
    );

    if (!success) {
      connection.send(
        JSON.stringify({
          type: 'error',
          message: 'Call not found or stream not available',
        })
      );
      connection.close();
    }
  });

  /**
   * REST endpoint to get all active calls available for monitoring
   */
  app.get(
    '/active-calls',
    {
      schema: {
        tags: ['monitoring'],
        summary: 'List active calls',
        description: 'Get all active calls available for monitoring with stream information',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              calls: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    callSid: { type: 'string' },
                    streamSid: { type: 'string' },
                    startedAt: { type: 'string', format: 'date-time' },
                    operatorCount: { type: 'number' },
                    metadata: {
                      type: 'object',
                      properties: {
                        from: { type: 'string' },
                        to: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        const calls = audioMonitoringService.getMonitorableCalls();

        logger.info('Active calls retrieved for monitoring', { count: calls.length });

        return reply.status(200).send({
          success: true,
          calls,
        });
      } catch (error) {
        logger.error('Failed to get active calls for monitoring', error as Error);
        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to retrieve active calls',
        });
      }
    }
  );

  /**
   * REST endpoint to get stream information for a specific call
   */
  app.get(
    '/stream-info/:callSid',
    {
      schema: {
        tags: ['monitoring'],
        summary: 'Get stream info',
        description: 'Get detailed stream information for a specific call',
        params: {
          type: 'object',
          properties: {
            callSid: { type: 'string' },
          },
          required: ['callSid'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              stream: {
                type: 'object',
                properties: {
                  callSid: { type: 'string' },
                  streamSid: { type: 'string' },
                  startedAt: { type: 'string', format: 'date-time' },
                  operatorCount: { type: 'number' },
                  metadata: {
                    type: 'object',
                    properties: {
                      from: { type: 'string' },
                      to: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { callSid } = request.params as { callSid: string };

      try {
        const streamInfo = audioMonitoringService.getStreamInfo(callSid);

        if (!streamInfo) {
          return reply.status(404).send({
            success: false,
            error: 'Stream not found for this call',
          });
        }

        return reply.status(200).send({
          success: true,
          stream: {
            callSid: streamInfo.callSid,
            streamSid: streamInfo.streamSid,
            startedAt: streamInfo.startedAt,
            operatorCount: streamInfo.operators.size,
            metadata: streamInfo.metadata,
          },
        });
      } catch (error) {
        logger.error('Failed to get stream info', error as Error);
        return reply.status(500 as 200 | 404).send({
          success: false,
          error: 'Failed to retrieve stream information',
        });
      }
    }
  );

  /**
   * REST endpoint to register a new stream (called when inbound call starts)
   */
  app.post(
    '/register-stream',
    {
      schema: {
        tags: ['monitoring'],
        summary: 'Register new stream',
        description: 'Register a new call stream for monitoring (internal use)',
        body: {
          type: 'object',
          required: ['callSid', 'streamSid'],
          properties: {
            callSid: { type: 'string' },
            streamSid: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z.object({
        callSid: z.string(),
        streamSid: z.string(),
        metadata: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
      });

      const body = bodySchema.parse(request.body);

      try {
        audioMonitoringService.registerTwilioStream(body.callSid, body.streamSid, body.metadata);

        logger.info('Stream registered successfully', {
          callSid: body.callSid,
          streamSid: body.streamSid,
        });

        return reply.status(200).send({
          success: true,
          message: 'Stream registered successfully',
        });
      } catch (error) {
        logger.error('Failed to register stream', error as Error);
        return reply.status(500 as 200).send({
          success: false,
          error: 'Failed to register stream',
        });
      }
    }
  );
};
