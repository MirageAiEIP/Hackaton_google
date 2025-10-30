import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { transcriptService } from '@/services/transcript.service';
import { logger } from '@/utils/logger';

export const transcriptsRoutes: FastifyPluginAsync = async (app) => {
  logger.info('Registering Transcripts Routes at /api/v1/transcripts');

  app.get(
    '/:callId',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Get call transcript',
        description: 'Retrieve the transcript for a specific call (both basic and structured)',
        params: {
          type: 'object',
          properties: {
            callId: {
              type: 'string',
              description: 'Call ID',
            },
          },
          required: ['callId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  callId: { type: 'string' },
                  status: { type: 'string' },
                  startedAt: { type: 'string' },
                  endedAt: { type: 'string', nullable: true },
                  duration: { type: 'number', nullable: true },
                  basicTranscript: { type: 'string', nullable: true },
                  structuredTranscript: { type: 'object', nullable: true },
                  patient: { type: 'object', nullable: true },
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
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);

        logger.info('GET /api/v1/transcripts/:callId called', { callId });

        const transcript = await transcriptService.getCallTranscript(callId);

        return {
          success: true,
          data: transcript,
        };
      } catch (error) {
        logger.error('Failed to get transcript', error as Error);

        if ((error as Error).message.includes('not found')) {
          reply.status(404 as 200);
          return {
            success: false,
            error: 'Call not found',
          };
        }

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to retrieve transcript',
        };
      }
    }
  );

  app.get(
    '/:callId/formatted',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Get formatted transcript',
        description: 'Retrieve formatted transcript with speaker labels and timestamps',
        params: {
          type: 'object',
          properties: {
            callId: {
              type: 'string',
              description: 'Call ID',
            },
          },
          required: ['callId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  callId: { type: 'string' },
                  status: { type: 'string' },
                  startedAt: { type: 'string' },
                  endedAt: { type: 'string', nullable: true },
                  duration: { type: 'number', nullable: true },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        index: { type: 'number' },
                        timestamp: { type: 'string', nullable: true },
                        speaker: { type: 'string' },
                        text: { type: 'string' },
                        confidence: { type: 'number', nullable: true },
                      },
                    },
                  },
                  patient: { type: 'object', nullable: true },
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
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);

        logger.info('GET /api/v1/transcripts/:callId/formatted called', { callId });

        const formattedTranscript = await transcriptService.getFormattedTranscript(callId);

        return {
          success: true,
          data: formattedTranscript,
        };
      } catch (error) {
        logger.error('Failed to get formatted transcript', error as Error);

        if ((error as Error).message.includes('not found')) {
          reply.status(404 as 200);
          return {
            success: false,
            error: 'Call not found',
          };
        }

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to retrieve formatted transcript',
        };
      }
    }
  );

  app.get(
    '/:callId/stats',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Get transcript statistics',
        description: 'Retrieve statistics about the transcript (word count, duration, etc.)',
        params: {
          type: 'object',
          properties: {
            callId: {
              type: 'string',
              description: 'Call ID',
            },
          },
          required: ['callId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  callId: { type: 'string' },
                  hasTranscript: { type: 'boolean' },
                  hasStructuredTranscript: { type: 'boolean' },
                  wordCount: { type: 'number' },
                  lineCount: { type: 'number' },
                  characterCount: { type: 'number' },
                  estimatedReadingTimeMinutes: { type: 'number' },
                  duration: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);

        logger.info('GET /api/v1/transcripts/:callId/stats called', { callId });

        const stats = await transcriptService.getTranscriptStats(callId);

        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        logger.error('Failed to get transcript stats', error as Error);

        if ((error as Error).message.includes('not found')) {
          reply.status(404 as 200);
          return {
            success: false,
            error: 'Call not found',
          };
        }

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to retrieve transcript statistics',
        };
      }
    }
  );

  app.post(
    '/bulk',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Get multiple transcripts',
        description: 'Retrieve transcripts for multiple calls (bulk retrieval)',
        body: {
          type: 'object',
          properties: {
            callIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of call IDs',
            },
          },
          required: ['callIds'],
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
                    callId: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    endedAt: { type: 'string', nullable: true },
                    duration: { type: 'number', nullable: true },
                    hasTranscript: { type: 'boolean' },
                    hasStructuredTranscript: { type: 'boolean' },
                    transcriptPreview: { type: 'string', nullable: true },
                  },
                },
              },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z.object({
        callIds: z.array(z.string().min(1)).min(1).max(100), // Max 100 calls at once
      });

      try {
        const { callIds } = bodySchema.parse(request.body);

        logger.info('POST /api/v1/transcripts/bulk called', { count: callIds.length });

        const transcripts = await transcriptService.getCallTranscripts(callIds);

        return {
          success: true,
          data: transcripts,
          count: transcripts.length,
        };
      } catch (error) {
        logger.error('Failed to get bulk transcripts', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to retrieve transcripts',
        };
      }
    }
  );

  app.get(
    '/search',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Search transcripts',
        description: 'Search transcripts by keyword with pagination',
        querystring: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'Search keyword',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return (default: 50)',
              default: 50,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (default: 0)',
              default: 0,
            },
          },
          required: ['keyword'],
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
                    callId: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    endedAt: { type: 'string', nullable: true },
                    patient: { type: 'object', nullable: true },
                    priority: { type: 'string', nullable: true },
                    chiefComplaint: { type: 'string', nullable: true },
                    transcriptExcerpt: { type: 'string' },
                  },
                },
              },
              count: { type: 'number' },
              keyword: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const querySchema = z.object({
        keyword: z.string().min(1),
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
      });

      try {
        const { keyword, limit, offset } = querySchema.parse(request.query);

        logger.info('GET /api/v1/transcripts/search called', { keyword, limit, offset });

        const results = await transcriptService.searchTranscripts(keyword, { limit, offset });

        return {
          success: true,
          data: results,
          count: results.length,
          keyword,
        };
      } catch (error) {
        logger.error('Failed to search transcripts', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to search transcripts',
        };
      }
    }
  );

  app.post(
    '/:callId/retry',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Retry transcript save',
        description:
          'Retry fetching and saving transcript from ElevenLabs API (useful if initial save failed)',
        params: {
          type: 'object',
          properties: {
            callId: {
              type: 'string',
              description: 'Call ID',
            },
          },
          required: ['callId'],
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
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);

        logger.info('POST /api/v1/transcripts/:callId/retry called', { callId });

        const { conversationPersistenceService } = await import(
          '@/services/conversation-persistence.service'
        );
        const success = await conversationPersistenceService.retrySaveConversation(callId);

        if (success) {
          return {
            success: true,
            message: 'Transcript saved successfully',
          };
        } else {
          reply.status(404 as 200);
          return {
            success: false,
            message:
              'Could not retry transcript save. Call not found or no conversation ID available.',
          };
        }
      } catch (error) {
        logger.error('Failed to retry transcript save', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          message: 'Failed to retry transcript save',
        };
      }
    }
  );

  app.post(
    '/bulk-retry',
    {
      schema: {
        tags: ['transcripts'],
        summary: 'Bulk retry transcript saves',
        description: 'Retry fetching and saving transcripts for multiple calls',
        body: {
          type: 'object',
          properties: {
            callIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of call IDs',
            },
          },
          required: ['callIds'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              successCount: { type: 'number' },
              failedCount: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z.object({
        callIds: z.array(z.string().min(1)).min(1).max(50), // Max 50 calls
      });

      try {
        const { callIds } = bodySchema.parse(request.body);

        logger.info('POST /api/v1/transcripts/bulk-retry called', { count: callIds.length });

        const { conversationPersistenceService } = await import(
          '@/services/conversation-persistence.service'
        );
        const result = await conversationPersistenceService.bulkSaveConversations(callIds);

        return {
          success: true,
          successCount: result.success,
          failedCount: result.failed,
          message: `Processed ${callIds.length} calls: ${result.success} succeeded, ${result.failed} failed`,
        };
      } catch (error) {
        logger.error('Failed to bulk retry transcript saves', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          message: 'Failed to bulk retry transcript saves',
        };
      }
    }
  );

  logger.info('Transcripts routes registered successfully');
};
