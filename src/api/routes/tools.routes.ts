import { FastifyInstance } from 'fastify';
import {
  executeGetPharmacyOnDuty,
  getPharmacyOnDutySchema,
} from '@/tools/get-pharmacy-on-duty.tool';
import {
  executeGetCurrentCallInfo,
  getCurrentCallInfoSchema,
} from '@/tools/get-current-call-info.tool';
import { executeUpdateCallInfo, updateCallInfoSchema } from '@/tools/update-call-info.tool';
import { dispatchSMURTool } from '@/tools/dispatch-smur.tool';
import { logger } from '@/utils/logger';

export const toolsRoutes = (app: FastifyInstance) => {
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
        const input = getPharmacyOnDutySchema.parse(request.body);

        logger.info('Tool webhook: get_pharmacy_on_duty', {
          conversation_id: input.conversation_id,
          postalCode: input.postalCode,
          city: input.city,
        });

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

  app.post(
    '/get_current_call_info',
    {
      schema: {
        tags: ['tools'],
        summary: 'Get current call info',
        description: 'ElevenLabs Client Tool: Retrieve complete call context (CALL FIRST)',
        body: {
          type: 'object',
          required: ['conversation_id'],
          properties: {
            conversation_id: {
              type: 'string',
              description: 'ID de conversation ElevenLabs (fourni automatiquement par ElevenLabs)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = getCurrentCallInfoSchema.parse(request.body);

        logger.info('Tool webhook: get_current_call_info', {
          conversationId: input.conversation_id,
        });

        const result = await executeGetCurrentCallInfo(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: get_current_call_info', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  app.post(
    '/update_call_info',
    {
      schema: {
        tags: ['tools'],
        summary: 'Update call info (simplified)',
        description: 'ElevenLabs Client Tool: Update call info with flat fields',
        body: {
          type: 'object',
          properties: {
            conversation_id: { type: 'string' },
            age: { type: 'number' },
            gender: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            postalCode: { type: 'string' },
            priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            priorityReason: { type: 'string' },
            chiefComplaint: { type: 'string' },
            currentSymptoms: { type: 'string' },
            consciousness: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = updateCallInfoSchema.parse(request.body);

        logger.info('Tool webhook: update_call_info', {
          conversationId: input.conversation_id,
          hasPriority: !!input.priority,
        });

        const result = await executeUpdateCallInfo(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: update_call_info', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  app.post(
    '/dispatch_smur',
    {
      schema: {
        tags: ['tools'],
        summary: 'Dispatch SMUR emergency services',
        description: 'ElevenLabs Client Tool: Dispatch ambulance/SMUR for P0/P1 emergencies',
        body: {
          type: 'object',
          required: ['priority', 'location', 'symptoms'],
          properties: {
            conversation_id: {
              type: 'string',
              description: 'ElevenLabs conversation ID (auto)',
            },
            priority: {
              type: 'string',
              enum: ['P0', 'P1'],
              description:
                'P0 pour urgence absolue (arrêt cardiaque), P1 pour urgence vitale (AVC, détresse respiratoire)',
            },
            location: {
              type: 'string',
              description:
                'Adresse complète du patient (rue, ville, code postal, étage, code accès)',
            },
            symptoms: {
              type: 'string',
              description: 'Description des symptômes urgents',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              dispatchId: { type: 'string' },
              callId: { type: 'string' },
              eta: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = dispatchSMURTool.parameters.parse(request.body);

        logger.info('Tool webhook: dispatch_smur', {
          priority: input.priority,
          location: input.location,
        });

        const result = await dispatchSMURTool.execute(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: dispatch_smur', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  app.post('/conversation-init', async (request, reply) => {
    // ===== LOG EVERYTHING FROM ELEVENLABS =====
    logger.info('[DEBUG] ElevenLabs conversation-init webhook called', {
      body: request.body,
      headers: request.headers,
      query: request.query,
      params: request.params,
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    });

    // Log raw body if available
    if (request.body) {
      logger.info('[DEBUG] Conversation init - Body keys', {
        keys: Object.keys(request.body as Record<string, unknown>),
        bodyType: typeof request.body,
      });
    }

    // Check for common identifiers
    const bodyWithId = request.body as Record<string, unknown>;
    const possibleIds = {
      conversation_id: bodyWithId.conversation_id,
      call_sid: bodyWithId.call_sid,
      callSid: bodyWithId.callSid,
      session_id: bodyWithId.session_id,
      from: bodyWithId.from,
      to: bodyWithId.to,
    };

    logger.info('[DEBUG] Possible identifiers in payload', possibleIds);

    // Return minimal valid conversation_initiation_client_data response
    // Format: https://elevenlabs.io/docs/api-reference/websockets#conversation_initiation_client_data
    return reply.send({
      type: 'conversation_initiation_client_data',
      conversation_initiation_client_data: {
        custom_llm_extra_body: {
          debug: 'This is a test response',
          receivedAt: new Date().toISOString(),
        },
      },
    });
  });

  app.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'ElevenLabs Client Tools endpoints are healthy',
      tools: ['get_current_call_info', 'update_call_info', 'dispatch_smur', 'get_pharmacy_on_duty'],
      timestamp: new Date().toISOString(),
    });
  });
};
