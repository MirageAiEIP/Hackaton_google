import { FastifyInstance } from 'fastify';
import {
  executeGetPatientHistory,
  getPatientHistorySchema,
} from '@/tools/get-patient-history.tool';
import {
  executeGetPharmacyOnDuty,
  getPharmacyOnDutySchema,
} from '@/tools/get-pharmacy-on-duty.tool';
import {
  executeRequestHumanHandoff,
  requestHumanHandoffSchema,
} from '@/tools/request-human-handoff.tool';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tools Routes
 * These endpoints are called by the ElevenLabs agent via webhooks
 * Each tool is configured in the ElevenLabs dashboard
 */
export const toolsRoutes = (app: FastifyInstance) => {
  /**
   * Get Patient History Tool
   * POST /api/v1/tools/get_patient_history
   *
   * Called by AI agent to check patient's previous calls
   * Returns: call history, chronic conditions, allergies, medications
   */
  app.post(
    '/get_patient_history',
    {
      schema: {
        tags: ['tools'],
        summary: 'Get patient call history',
        description: 'ElevenLabs Client Tool: Retrieve patient history by phone hash',
        body: {
          type: 'object',
          required: ['phoneHash'],
          properties: {
            phoneHash: {
              type: 'string',
              description: 'SHA-256 hash of patient phone number',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              hasHistory: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  callCount: { type: 'number' },
                  calls: { type: 'array' },
                  chronicConditions: { type: 'array' },
                  allergies: { type: 'array' },
                  medications: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate input with Zod
        const input = getPatientHistorySchema.parse(request.body);

        logger.info('Tool webhook: get_patient_history', {
          phoneHash: input.phoneHash.substring(0, 8) + '***',
        });

        // Execute tool
        const result = await executeGetPatientHistory(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: get_patient_history', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Get Pharmacy On Duty Tool
   * POST /api/v1/tools/get_pharmacy_on_duty
   *
   * Called by AI agent to find nearby pharmacies on duty
   * Returns: list of open pharmacies with addresses and phone numbers
   */
  app.post(
    '/get_pharmacy_on_duty',
    {
      schema: {
        tags: ['tools'],
        summary: 'Find pharmacies on duty',
        description: 'ElevenLabs Client Tool: Find nearby pharmacies currently open',
        body: {
          type: 'object',
          properties: {
            postalCode: {
              type: 'string',
              description: 'Patient postal code',
            },
            city: {
              type: 'string',
              description: 'Patient city name',
            },
            latitude: {
              type: 'number',
              description: 'Patient latitude',
            },
            longitude: {
              type: 'number',
              description: 'Patient longitude',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  count: { type: 'number' },
                  pharmacies: { type: 'array' },
                  searchArea: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate input with Zod
        const input = getPharmacyOnDutySchema.parse(request.body);

        logger.info('Tool webhook: get_pharmacy_on_duty', {
          postalCode: input.postalCode,
          city: input.city,
        });

        // Execute tool
        const result = await executeGetPharmacyOnDuty(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: get_pharmacy_on_duty', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Request Human Handoff Tool
   * POST /api/v1/tools/request_human_handoff
   *
   * Called by AI agent when human intervention is needed
   * Returns: handoff ID, status, assigned operator
   */
  app.post(
    '/request_human_handoff',
    {
      schema: {
        tags: ['tools'],
        summary: 'Request human handoff',
        description: 'ElevenLabs Client Tool: Request handoff from AI to human operator',
        body: {
          type: 'object',
          required: ['callId', 'conversationId', 'reason', 'transcript', 'patientSummary'],
          properties: {
            callId: {
              type: 'string',
              description: 'Unique call identifier',
            },
            conversationId: {
              type: 'string',
              description: 'ElevenLabs conversation ID',
            },
            reason: {
              type: 'string',
              description: 'Reason for handoff',
            },
            transcript: {
              type: 'string',
              description: 'Full conversation transcript',
            },
            patientSummary: {
              type: 'string',
              description: 'AI-generated patient summary',
            },
            aiContext: {
              type: 'object',
              description: 'Additional AI context',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              handoffId: { type: 'string' },
              status: { type: 'string' },
              message: { type: 'string' },
              assignedOperatorId: { type: 'string' },
              instructions: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Validate input with Zod
        const input = requestHumanHandoffSchema.parse(request.body);

        logger.info('Tool webhook: request_human_handoff', {
          callId: input.callId,
          conversationId: input.conversationId,
        });

        // Execute tool
        const result = await executeRequestHumanHandoff(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: request_human_handoff', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Health check for tools endpoints
   * GET /api/v1/tools/health
   */
  app.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'ElevenLabs Client Tools endpoints are healthy',
      tools: [
        'get_patient_history',
        'get_pharmacy_on_duty',
        'request_human_handoff',
        'dispatch_smur', // Existing tool
      ],
      timestamp: new Date().toISOString(),
    });
  });
};
