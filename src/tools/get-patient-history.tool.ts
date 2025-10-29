import { z } from 'zod';
import { Container } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';

export const getPatientHistorySchema = z.object({
  phoneHash: z.string().describe('SHA-256 hash of patient phone number'),
});

export type GetPatientHistoryInput = z.infer<typeof getPatientHistorySchema>;

export async function executeGetPatientHistory(input: GetPatientHistoryInput) {
  const { phoneHash } = input;

  logger.info('Client Tool: get_patient_history called', {
    phoneHash: phoneHash.substring(0, 8) + '***',
  });

  try {
    // Use Prisma directly to get calls with patient and triage report relations
    const container = Container.getInstance();
    const prisma = container.getPrisma();

    // Find patient by phone hash
    const patient = await prisma.patient.findUnique({
      where: { phoneHash },
      include: {
        calls: {
          include: {
            triageReport: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient || patient.calls.length === 0) {
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

    // Extract medical history from patient
    const chronicConditions = patient.chronicConditions || [];
    const allergies = patient.allergies || [];
    const medications = patient.medications || [];

    const calls = patient.calls;

    // Format calls for AI agent
    const callHistory = calls.map((call: (typeof calls)[0]) => ({
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

export const getPatientHistoryToolDefinition = {
  name: 'get_patient_history',
  description:
    'Retrieve patient call history and medical information based on phone number hash. Use this to check if patient has called before and access their medical history (chronic conditions, allergies, medications). This helps provide personalized care and avoid asking redundant questions.',
  parameters: getPatientHistorySchema,
  execute: executeGetPatientHistory,
};
