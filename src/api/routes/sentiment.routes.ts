import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { hybridSentimentService } from '@/services/analysis/hybrid-sentiment.service';
import { storageService } from '@/services/storage.service';
import { logger } from '@/utils/logger';

/**
 * Sentiment analysis routes
 *
 * POST /api/v1/sentiment/analyze - Analyze text + optional audio
 * POST /api/v1/sentiment/upload-audio - Upload audio file
 */
export const sentimentRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Analyze sentiment from text and optional audio
   */
  app.post(
    '/analyze',
    {
      schema: {
        description: 'Analyze sentiment from transcript and optional audio',
        tags: ['Sentiment Analysis'],
        body: {
          type: 'object',
          required: ['callId'],
          properties: {
            callId: { type: 'string', description: 'Call identifier' },
            transcript: {
              type: 'string',
              description:
                'Text transcript (optional if audioUrl provided - will use Whisper transcription)',
              minLength: 10,
            },
            audioUrl: {
              type: 'string',
              description:
                'Audio file path (WAV format). If provided, Whisper transcription will be used for analysis.',
            },
          },
          anyOf: [{ required: ['transcript'] }, { required: ['audioUrl'] }],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  textScore: { type: 'number' },
                  audioScore: { type: 'number' },
                  finalScore: { type: 'number' },
                  coherence: { type: 'string' },
                  recommendation: { type: 'string' },
                  pointsAdjustment: { type: 'number' },
                  confidence: { type: 'number' },
                  reasoning: { type: 'string' },
                },
              },
              metadata: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                },
              },
            },
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
              metadata: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const bodySchema = z
        .object({
          callId: z.string().min(1),
          transcript: z.string().min(10).optional(),
          audioUrl: z.string().optional(),
        })
        .refine((data) => data.transcript || data.audioUrl, {
          message: 'Either transcript or audioUrl must be provided',
        });

      const body = bodySchema.parse(request.body);
      const transcript = body.transcript || 'Audio transcription in progress';

      logger.info('Sentiment analysis requested', {
        callId: body.callId,
        transcriptLength: transcript.length,
        hasAudio: !!body.audioUrl,
        transcriptProvided: !!body.transcript,
      });

      try {
        const analysis = await hybridSentimentService.analyzeHybrid({
          callId: body.callId,
          transcript,
          audioUrl: body.audioUrl,
        });

        return reply.status(200).send({
          success: true,
          data: analysis,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Sentiment analysis failed', error as Error, {
          callId: body.callId,
        });

        return reply.code(500).send({
          success: false,
          error: {
            code: 'SENTIMENT_ANALYSIS_FAILED',
            message: 'Failed to analyze sentiment',
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  );

  /**
   * Upload audio file for analysis
   * Only WAV format supported (16kHz, mono, LINEAR16 PCM)
   * Use convert-audio.cjs to convert other formats
   */
  app.post(
    '/upload-audio',
    {
      schema: {
        description: 'Upload WAV audio file for sentiment analysis (16kHz, mono, LINEAR16 PCM)',
        tags: ['Sentiment Analysis'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  audioUrl: {
                    type: 'string',
                    description: 'GCS URI of uploaded file',
                  },
                  callId: { type: 'string' },
                  uploadedAt: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          500: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        logger.info('Upload request received');

        let callId: string = '';
        let hasAudioFile = false;
        let audioMimetype: string = '';
        let audioFilename: string = '';

        // Parse multipart form data using parts()
        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === 'field') {
            // It's a field
            if (part.fieldname === 'callId') {
              callId = part.value as string;
              logger.info('CallId field received', { callId });
            }
          } else {
            // It's a file
            if (part.fieldname === 'audio') {
              audioMimetype = part.mimetype;
              audioFilename = part.filename;
              logger.info('Audio file received', {
                mimetype: audioMimetype,
                filename: audioFilename,
              });

              // Read audio file into buffer
              const chunks: Buffer[] = [];
              for await (const chunk of part.file) {
                chunks.push(chunk);
              }
              const audioBuffer = Buffer.concat(chunks);
              const fileSize = audioBuffer.length;
              logger.info('Audio file read into buffer', { fileSize });

              // Upload to Google Cloud Storage (or fallback to local)
              audioFilename = await storageService.uploadAudio(audioBuffer, callId, audioFilename);
              hasAudioFile = true;
            }
          }
        }

        // Validate
        if (!hasAudioFile) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'NO_FILE_PROVIDED',
              message: 'No audio file provided',
            },
          });
        }

        if (!callId) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'MISSING_CALL_ID',
              message: 'callId is required',
            },
          });
        }

        // Validate file type - Only WAV files are supported
        const fileExtension = audioFilename.toLowerCase().substring(audioFilename.lastIndexOf('.'));

        if (fileExtension !== '.wav') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_FILE_TYPE',
              message: `Only WAV files are supported. Got: ${fileExtension}. Use convert-audio.cjs to convert your audio to WAV (16kHz, mono, LINEAR16 PCM).`,
            },
          });
        }

        // Return the local file path for Speech-to-Text processing
        const audioUrl = audioFilename; // Use local path instead of GCS URL

        logger.info('Audio file saved locally for processing', {
          callId,
          audioUrl,
        });

        return reply.code(200).send({
          success: true,
          data: {
            audioUrl,
            callId,
            uploadedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error('Audio upload failed', error as Error);

        return reply.code(500).send({
          success: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: 'Failed to upload audio file',
          },
        });
      }
    }
  );
};
