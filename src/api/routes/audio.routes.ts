import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { audioService } from '@/services/audio.service';
import { logger } from '@/utils/logger';

export const audioRoutes: FastifyPluginAsync = async (app) => {
  logger.info('Registering Audio Routes at /api/v1/audio');

  app.get(
    '/:callId',
    {
      schema: {
        tags: ['audio'],
        summary: 'Get call audio info',
        description: 'Get audio URL and metadata for a specific call',
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
                  hasAudio: { type: 'boolean' },
                  audioUrl: { type: 'string' },
                  source: { type: 'string' },
                  mimeType: { type: 'string' },
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

        logger.info('GET /api/v1/audio/:callId called', { callId });

        const audioData = await audioService.getCallAudio(callId);

        return {
          success: true,
          data: audioData,
        };
      } catch (error) {
        logger.error('Failed to get audio info', error as Error);

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
          error: 'Failed to get audio info',
        };
      }
    }
  );

  app.get(
    '/:callId/stream',
    {
      schema: {
        tags: ['audio'],
        summary: 'Stream call audio',
        description: 'Stream audio recording for playback in browser',
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
        querystring: {
          type: 'object',
          properties: {
            download: {
              type: 'boolean',
              description: 'Download as file instead of streaming',
              default: false,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      const querySchema = z.object({
        download: z.coerce.boolean().default(false),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);
        const { download } = querySchema.parse(request.query);

        logger.info('GET /api/v1/audio/:callId/stream called', { callId, download });

        const audioData = await audioService.getCallAudioBuffer(callId);

        if (!audioData) {
          reply.status(404 as 200);
          return {
            success: false,
            error: 'Audio not found for this call',
          };
        }

        // Set headers for audio streaming
        reply.header('Content-Type', audioData.mimeType);
        reply.header('Content-Length', audioData.buffer.length);
        reply.header('Accept-Ranges', 'bytes');

        if (download) {
          reply.header('Content-Disposition', `attachment; filename="call_${callId}.mp3"`);
        } else {
          reply.header('Content-Disposition', 'inline');
        }

        // Enable CORS for audio playback
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

        return reply.send(audioData.buffer);
      } catch (error) {
        logger.error('Failed to stream audio', error as Error);

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
          error: 'Failed to stream audio',
        };
      }
    }
  );

  app.get(
    '/:callId/download',
    {
      schema: {
        tags: ['audio'],
        summary: 'Download call audio',
        description: 'Download audio recording as file',
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
      },
    },
    async (request, reply) => {
      const paramsSchema = z.object({
        callId: z.string().min(1),
      });

      try {
        const { callId } = paramsSchema.parse(request.params);

        logger.info('GET /api/v1/audio/:callId/download called', { callId });

        const audioData = await audioService.getCallAudioBuffer(callId);

        if (!audioData) {
          reply.status(404 as 200);
          return {
            success: false,
            error: 'Audio not found for this call',
          };
        }

        reply.header('Content-Type', audioData.mimeType);
        reply.header('Content-Disposition', `attachment; filename="call_${callId}.mp3"`);
        reply.header('Content-Length', audioData.buffer.length);

        return reply.send(audioData.buffer);
      } catch (error) {
        logger.error('Failed to download audio', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to download audio',
        };
      }
    }
  );

  app.get(
    '/:callId/metadata',
    {
      schema: {
        tags: ['audio'],
        summary: 'Get audio metadata',
        description: 'Get metadata about the audio recording (duration, size, format)',
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
                  hasAudio: { type: 'boolean' },
                  duration: { type: 'number' },
                  size: { type: 'number' },
                  format: { type: 'string' },
                  source: { type: 'string' },
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

        logger.info('GET /api/v1/audio/:callId/metadata called', { callId });

        const metadata = await audioService.getAudioMetadata(callId);

        return {
          success: true,
          data: metadata,
        };
      } catch (error) {
        logger.error('Failed to get audio metadata', error as Error);

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
          error: 'Failed to get audio metadata',
        };
      }
    }
  );

  app.get(
    '/list',
    {
      schema: {
        tags: ['audio'],
        summary: 'List calls with audio',
        description: 'List all calls that have audio recordings available',
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of results to return',
              default: 50,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip',
              default: 0,
            },
            status: {
              type: 'string',
              description: 'Filter by call status',
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
                    callId: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    endedAt: { type: 'string', nullable: true },
                    hasAudio: { type: 'boolean' },
                    audioSource: { type: 'string' },
                    duration: { type: 'number', nullable: true },
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
      const querySchema = z.object({
        limit: z.coerce.number().min(1).max(100).default(50),
        offset: z.coerce.number().min(0).default(0),
        status: z.string().optional(),
      });

      try {
        const { limit, offset, status } = querySchema.parse(request.query);

        logger.info('GET /api/v1/audio/list called', { limit, offset, status });

        const calls = await audioService.listCallsWithAudio({ limit, offset, status });

        return {
          success: true,
          data: calls,
          count: calls.length,
        };
      } catch (error) {
        logger.error('Failed to list audio calls', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to list calls with audio',
        };
      }
    }
  );

  app.post(
    '/:callId/fetch',
    {
      schema: {
        tags: ['audio'],
        summary: 'Fetch audio from ElevenLabs',
        description:
          'Manually fetch audio from ElevenLabs API if not already saved (useful for retry)',
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

        logger.info('POST /api/v1/audio/:callId/fetch called', { callId });

        // This will fetch from ElevenLabs if not in database
        const audioData = await audioService.getCallAudio(callId);

        if (audioData.hasAudio) {
          return {
            success: true,
            message:
              audioData.source === 'elevenlabs'
                ? 'Audio fetched from ElevenLabs and saved'
                : 'Audio already available in database',
          };
        } else {
          reply.status(404 as 200);
          return {
            success: false,
            message: 'No audio available for this call',
          };
        }
      } catch (error) {
        logger.error('Failed to fetch audio', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to fetch audio',
        };
      }
    }
  );

  app.delete(
    '/:callId',
    {
      schema: {
        tags: ['audio'],
        summary: 'Delete call audio',
        description: 'Delete audio recording from storage and database',
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

        logger.info('DELETE /api/v1/audio/:callId called', { callId });

        const success = await audioService.deleteAudio(callId);

        if (success) {
          return {
            success: true,
            message: 'Audio deleted successfully',
          };
        } else {
          reply.status(500 as 200);
          return {
            success: false,
            message: 'Failed to delete audio',
          };
        }
      } catch (error) {
        logger.error('Failed to delete audio', error as Error);

        reply.status(500 as 200);
        return {
          success: false,
          error: 'Failed to delete audio',
        };
      }
    }
  );

  logger.info('Audio routes registered successfully');
};
