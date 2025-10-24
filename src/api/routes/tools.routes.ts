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
import {
  executeGetCurrentCallInfo,
  getCurrentCallInfoSchema,
} from '@/tools/get-current-call-info.tool';
import { executeUpdateCallInfo, updateCallInfoSchema } from '@/tools/update-call-info.tool';
import {
  executeCheckOperatorAvailable,
  checkOperatorAvailableSchema,
} from '@/tools/check-operator-available.tool';
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
        // ===== DEBUG: LOG COMPLET DU WEBHOOK ELEVENLABS =====
        logger.info('[DEBUG] ElevenLabs webhook RAW DATA', {
          body: request.body,
          headers: request.headers,
          method: request.method,
          url: request.url,
        });

        // Vérifier si conversation_id est présent
        const bodyWithConvId = request.body as Record<string, unknown>;
        if (bodyWithConvId.conversation_id) {
          logger.info('conversation_id FOUND in webhook', {
            conversation_id: bodyWithConvId.conversation_id,
          });
        } else {
          logger.warn('conversation_id NOT FOUND in webhook', {
            receivedKeys: Object.keys(bodyWithConvId),
          });
        }
        // ===== FIN DEBUG =====

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
   * Get Current Call Info Tool
   * POST /api/v1/tools/get_current_call_info
   *
   * Called by AI agent to retrieve complete call + patient + history context
   * MUST be called FIRST at the beginning of the conversation
   */
  app.post(
    '/get_current_call_info',
    {
      schema: {
        tags: ['tools'],
        summary: 'Get current call info',
        description: 'ElevenLabs Client Tool: Retrieve complete call context (CALL FIRST)',
        body: {
          type: 'object',
          required: ['callId'],
          properties: {
            callId: {
              type: 'string',
              description: "ID de l'appel en cours",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = getCurrentCallInfoSchema.parse(request.body);

        logger.info('Tool webhook: get_current_call_info', {
          callId: input.callId,
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

  /**
   * Update Call Info Tool (UNIFIED)
   * POST /api/v1/tools/update_call_info
   *
   * Updates patient info (admin) + call info (medical) in one call
   * All fields optional - only provided fields are updated
   */
  app.post(
    '/update_call_info',
    {
      schema: {
        tags: ['tools'],
        summary: 'Update call and patient info',
        description: 'ElevenLabs Client Tool: Update patient (admin) + call (medical) info',
        body: {
          type: 'object',
          required: ['callId'],
          properties: {
            callId: { type: 'string' },
            patientInfo: { type: 'object' },
            priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            priorityReason: { type: 'string' },
            chiefComplaint: { type: 'string' },
            currentSymptoms: { type: 'string' },
            vitalSigns: { type: 'object' },
            contextInfo: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = updateCallInfoSchema.parse(request.body);

        logger.info('Tool webhook: update_call_info', {
          callId: input.callId,
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

  /**
   * Check Operator Available Tool
   * POST /api/v1/tools/check_operator_available
   *
   * Checks if a human operator is available
   * If not: automatically adds call to queue
   */
  app.post(
    '/check_operator_available',
    {
      schema: {
        tags: ['tools'],
        summary: 'Check operator availability',
        description: 'ElevenLabs Client Tool: Check if operator available (auto-queue if not)',
        body: {
          type: 'object',
          required: ['callId', 'priority'],
          properties: {
            callId: { type: 'string' },
            priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const input = checkOperatorAvailableSchema.parse(request.body);

        logger.info('Tool webhook: check_operator_available', {
          callId: input.callId,
          priority: input.priority,
        });

        const result = await executeCheckOperatorAvailable(input);

        return reply.send(result);
      } catch (error) {
        logger.error('Tool webhook failed: check_operator_available', error as Error);
        return reply.status(400 as 200).send({
          success: false,
          error: 'Invalid input',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * Conversation Initialization Webhook (DEBUG)
   * POST /api/v1/tools/conversation-init
   *
   * Called by ElevenLabs at the START of each conversation to retrieve initial client data
   * This endpoint logs everything ElevenLabs sends to help us understand the payload structure
   */
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

  /**
   * Health check for tools endpoints
   * GET /api/v1/tools/health
   */
  app.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'ElevenLabs Client Tools endpoints are healthy',
      tools: [
        'get_current_call_info',
        'update_call_info',
        'check_operator_available',
        'get_patient_history',
        'get_pharmacy_on_duty',
        'request_human_handoff',
        'dispatch_smur',
      ],
      timestamp: new Date().toISOString(),
    });
  });
};
