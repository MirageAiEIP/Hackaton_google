import { z } from 'zod';
import { operatorService } from '@/services/operator.service';
import { queueService } from '@/services/queue.service';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tool: check_operator_available
 *
 * Vérifie si un médecin régulateur humain est disponible.
 * Si NON disponible : ajoute automatiquement l'appel à la file d'attente.
 *
 * USAGE:
 * - Agent 1 (ARM) : Appelle après classification ABCD pour savoir s'il doit
 *   transférer à un humain ou à l'Agent 2
 * - Agent 2 (Medical) : Appelle périodiquement pour vérifier si un opérateur s'est libéré
 */

export const checkOperatorAvailableSchema = z.object({
  callId: z.string().describe("ID de l'appel"),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).describe("Priorité de l'appel (P0-P3)"),
});

export type CheckOperatorAvailableInput = z.infer<typeof checkOperatorAvailableSchema>;

export interface CheckOperatorAvailableResponse {
  success: boolean;
  available: boolean;
  operatorId?: string;
  operatorName?: string;
  queuePosition?: number;
  estimatedWaitTime?: number; // en secondes
  message: string;
}

export async function executeCheckOperatorAvailable(
  input: CheckOperatorAvailableInput
): Promise<CheckOperatorAvailableResponse> {
  logger.info('Executing tool: check_operator_available', {
    callId: input.callId,
    priority: input.priority,
  });

  try {
    // Vérifier s'il y a un opérateur AVAILABLE
    const availableOperators = await operatorService.getAvailableOperators();

    // ===== CAS 1 : OPÉRATEUR DISPONIBLE =====
    if (availableOperators.length > 0) {
      const operator = availableOperators[0]!; // Premier opérateur disponible

      logger.info('Operator available', {
        callId: input.callId,
        operatorId: operator.id,
        operatorName: operator.name,
      });

      return {
        success: true,
        available: true,
        operatorId: operator.id,
        operatorName: operator.name,
        message: `Médecin régulateur disponible: ${operator.name}. Prêt pour transfert.`,
      };
    }

    // ===== CAS 2 : AUCUN OPÉRATEUR DISPONIBLE → AJOUTER À LA QUEUE =====

    // Vérifier si l'appel est déjà dans la queue
    const existingQueueEntry = await queueService.getQueueEntryByCallId(input.callId);

    if (existingQueueEntry) {
      // Déjà dans la queue, retourner position
      const queuePosition = await queueService.getPositionInQueue(existingQueueEntry.id);
      const estimatedWaitTime = queuePosition * 180; // Estimation : 3 min par appel

      logger.info('Call already in queue', {
        callId: input.callId,
        queueEntryId: existingQueueEntry.id,
        queuePosition,
      });

      return {
        success: true,
        available: false,
        queuePosition,
        estimatedWaitTime,
        message: `Aucun médecin disponible actuellement. Vous êtes en position ${queuePosition} dans la file d'attente. Temps d'attente estimé: ${Math.ceil(estimatedWaitTime / 60)} minutes.`,
      };
    }

    // Ajouter à la queue automatiquement
    const call = await callService.getCallById(input.callId);

    if (!call) {
      return {
        success: false,
        available: false,
        message: `Appel ${input.callId} non trouvé`,
      };
    }

    // Type casting car getCallById retourne Call avec include patient
    const callWithPatient = call as typeof call & {
      patient: { age: number | null; gender: string | null; address: string | null } | null;
    };

    const queueEntry = await queueService.addToQueue({
      callId: input.callId,
      priority: input.priority,
      chiefComplaint: call.chiefComplaint || 'Non renseigné',
      patientAge: callWithPatient.patient?.age ?? undefined,
      patientGender: callWithPatient.patient?.gender ?? undefined,
      location: callWithPatient.patient?.address ?? undefined,
      aiSummary: call.currentSymptoms || 'En cours de collecte',
      aiRecommendation: call.priorityReason || 'Classification en cours',
      keySymptoms: [],
      redFlags: [],
      conversationId: undefined,
    });

    const queuePosition = await queueService.getPositionInQueue(queueEntry.id);
    const estimatedWaitTime = queuePosition * 180; // 3 min par appel

    logger.info('Call added to queue automatically', {
      callId: input.callId,
      queueEntryId: queueEntry.id,
      priority: input.priority,
      queuePosition,
    });

    return {
      success: true,
      available: false,
      queuePosition,
      estimatedWaitTime,
      message: `Aucun médecin disponible actuellement. Votre appel a été ajouté à la file d'attente prioritaire (priorité ${input.priority}). Position: ${queuePosition}. Temps d'attente estimé: ${Math.ceil(estimatedWaitTime / 60)} minutes.`,
    };
  } catch (error) {
    logger.error('Tool execution failed: check_operator_available', error as Error, {
      callId: input.callId,
      priority: input.priority,
    });

    return {
      success: false,
      available: false,
      message: `Erreur lors de la vérification: ${(error as Error).message}`,
    };
  }
}
