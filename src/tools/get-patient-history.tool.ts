import { z } from 'zod';
import { Container } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tool: Get Patient History
 * Called by AI agent to retrieve patient's previous call history
 * Uses CQRS query handler with Redis caching
 */

/**
 * Tool input schema (validated with Zod)
 */
export const getPatientHistorySchema = z.object({
  phoneHash: z.string().describe('SHA-256 hash of patient phone number'),
});

export type GetPatientHistoryInput = z.infer<typeof getPatientHistorySchema>;

/**
 * Tool execution function
 * Called when ElevenLabs agent invokes this tool
 */
export async function executeGetPatientHistory(input: GetPatientHistoryInput) {
  const { phoneHash } = input;

  logger.info('Client Tool: get_patient_history called', {
    phoneHash: phoneHash.substring(0, 8) + '***',
  });

  try {
    // Use CQRS query handler from DI container
    const container = Container.getInstance();

    // Execute query using repository
    // Note: Could use GetPatientHistoryHandler for caching in production
    const calls = await container.getCallRepository().findByPhoneHash(phoneHash);

    if (calls.length === 0) {
      return {
        success: true,
        hasHistory: false,
        message: 'No previous calls found for this patient',
        data: {
          callCount: 0,
          calls: [],
          chronicConditions: [],
          allergies: [],
          medications: [],
        },
      };
    }

    // Extract medical history from calls
    const chronicConditions: string[] = [];
    const allergies: string[] = [];
    const medications: string[] = [];

    // Aggregate data from all calls
    calls.forEach((call: unknown) => {
      if (call.patient) {
        if (call.patient.chronicConditions) {
          chronicConditions.push(...call.patient.chronicConditions);
        }
        if (call.patient.allergies) {
          allergies.push(...call.patient.allergies);
        }
        if (call.patient.medications) {
          medications.push(...call.patient.medications);
        }
      }
    });

    // Format calls for AI agent
    const callHistory = calls.map((call: unknown) => ({
      id: call.id,
      date: call.startedAt,
      duration: call.duration,
      status: call.status,
      priority: call.triageReport?.priorityLevel || 'UNKNOWN',
      chiefComplaint: call.triageReport?.chiefComplaint || 'Not recorded',
      outcome: call.triageReport?.recommendedAction || 'UNKNOWN',
    }));

    logger.info('Patient history retrieved successfully', {
      phoneHash: phoneHash.substring(0, 8) + '***',
      callCount: calls.length,
    });

    return {
      success: true,
      hasHistory: true,
      message: `Found ${calls.length} previous call(s)`,
      data: {
        callCount: calls.length,
        calls: callHistory,
        chronicConditions: [...new Set(chronicConditions)],
        allergies: [...new Set(allergies)],
        medications: [...new Set(medications)],
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve patient history', error as Error, {
      phoneHash: phoneHash.substring(0, 8) + '***',
    });

    return {
      success: false,
      error: 'Failed to retrieve patient history',
      message: 'Internal error occurred while fetching patient data',
    };
  }
}

/**
 * Tool definition for ElevenLabs dashboard configuration
 */
export const getPatientHistoryToolDefinition = {
  name: 'get_patient_history',
  description:
    'Retrieve patient call history and medical information based on phone number hash. Use this to check if patient has called before and access their medical history (chronic conditions, allergies, medications). This helps provide personalized care and avoid asking redundant questions.',
  parameters: getPatientHistorySchema,
  execute: executeGetPatientHistory,
};
