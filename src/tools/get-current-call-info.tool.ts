import { z } from 'zod';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';
import { executeGetPatientHistory } from '@/tools/get-patient-history.tool';

/**
 * ElevenLabs Client Tool: get_current_call_info
 *
 * Récupère les informations disponibles sur l'appel en cours et le patient
 * (identité, adresse, antécédents, appels précédents).
 *
 * USAGE: Les agents doivent TOUJOURS appeler ce tool en premier
 * au début de la conversation pour récupérer le contexte.
 */

export const getCurrentCallInfoSchema = z.object({
  callId: z.string().describe("ID de l'appel en cours"),
});

export type GetCurrentCallInfoInput = z.infer<typeof getCurrentCallInfoSchema>;

export interface GetCurrentCallInfoResponse {
  success: boolean;
  data?: {
    call: {
      id: string;
      status: string;
      priority: string | null;
      priorityReason: string | null;
      chiefComplaint: string | null;
      currentSymptoms: string | null;
      vitalSigns: Record<string, unknown> | null;
      contextInfo: Record<string, unknown> | null;
      startedAt: string;
      duration: number | null;
    };
    patient: {
      id: string;
      age: number | null;
      gender: string | null;
      address: string | null;
      city: string | null;
      postalCode: string | null;
      chronicConditions: string[];
      allergies: string[];
      medications: string[];
    } | null;
    previousCalls: Array<{
      id: string;
      date: string;
      priority: string | null;
      reason: string | null;
      duration: number | null;
    }>;
  };
  message: string;
}

export async function executeGetCurrentCallInfo(
  input: GetCurrentCallInfoInput
): Promise<GetCurrentCallInfoResponse> {
  logger.info('Executing tool: get_current_call_info', { callId: input.callId });

  try {
    // Récupérer l'appel avec patient + historique
    const call = await callService.getCallById(input.callId);

    if (!call) {
      return {
        success: false,
        message: `Appel ${input.callId} non trouvé`,
      };
    }

    // Type casting car getCallById retourne Call avec include patient
    const callWithPatient = call as typeof call & {
      patient: {
        id: string;
        phoneHash: string;
        age: number | null;
        gender: string | null;
        address: string | null;
        city: string | null;
        postalCode: string | null;
        chronicConditions: string[];
        allergies: string[];
        medications: string[];
      } | null;
    };

    // Récupérer l'historique des appels du patient (réutilise le tool existant)
    let filteredPreviousCalls: Array<{
      id: string;
      date: string;
      priority: string | null;
      reason: string | null;
      duration: number | null;
    }> = [];

    if (callWithPatient.patient?.phoneHash) {
      const historyResult = await executeGetPatientHistory({
        phoneHash: callWithPatient.patient.phoneHash,
      });

      if (historyResult.success && historyResult.data?.calls) {
        // Filtrer l'appel actuel et limiter à 5
        filteredPreviousCalls = (
          historyResult.data.calls as unknown as Array<{
            id: string;
            date: string;
            priority?: string;
            reason?: string;
            duration?: number;
          }>
        )
          .filter((c) => c.id !== call.id)
          .slice(0, 5)
          .map((c) => ({
            id: c.id,
            date: c.date,
            priority: c.priority || null,
            reason: c.reason || null,
            duration: c.duration || null,
          }));
      }
    }

    const response: GetCurrentCallInfoResponse = {
      success: true,
      data: {
        call: {
          id: call.id,
          status: call.status,
          priority: call.priority || null,
          priorityReason: call.priorityReason || null,
          chiefComplaint: call.chiefComplaint || null,
          currentSymptoms: call.currentSymptoms || null,
          vitalSigns: (call.vitalSigns as Record<string, unknown>) || null,
          contextInfo: (call.contextInfo as Record<string, unknown>) || null,
          startedAt: call.startedAt.toISOString(),
          duration: call.duration || null,
        },
        patient: callWithPatient.patient
          ? {
              id: callWithPatient.patient.id,
              age: callWithPatient.patient.age || null,
              gender: callWithPatient.patient.gender || null,
              address: callWithPatient.patient.address || null,
              city: callWithPatient.patient.city || null,
              postalCode: callWithPatient.patient.postalCode || null,
              chronicConditions: callWithPatient.patient.chronicConditions || [],
              allergies: callWithPatient.patient.allergies || [],
              medications: callWithPatient.patient.medications || [],
            }
          : null,
        previousCalls: filteredPreviousCalls,
      },
      message:
        filteredPreviousCalls.length > 0
          ? `Patient connu avec ${filteredPreviousCalls.length} appel(s) précédent(s)`
          : 'Nouveau patient (aucun appel précédent)',
    };

    logger.info('Tool executed successfully: get_current_call_info', {
      callId: input.callId,
      hasPatient: !!callWithPatient.patient,
      previousCallsCount: filteredPreviousCalls.length,
    });

    return response;
  } catch (error) {
    logger.error('Tool execution failed: get_current_call_info', error as Error, {
      callId: input.callId,
    });

    return {
      success: false,
      message: `Erreur lors de la récupération des informations: ${(error as Error).message}`,
    };
  }
}
