import { z } from 'zod';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';
import { TwilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';

/**
 * ElevenLabs Client Tool: update_call_info (SIMPLIFIÉ)
 *
 * Met à jour les informations essentielles de l'appel en cours.
 * Tous les champs sont OPTIONNELS et APLATIS (pas d'objets imbriqués).
 *
 * Utilisation : L'agent appelle ce tool quand il obtient des nouvelles infos du patient.
 */

export const updateCallInfoSchema = z.object({
  // Identifiants
  conversation_id: z.string().optional().describe('ID de conversation ElevenLabs (fourni auto)'),

  // === INFOS PATIENT ===
  age: z.number().optional().describe('Âge du patient (ex: 45)'),
  gender: z.string().optional().describe('Sexe (M/F/Autre)'),
  address: z.string().optional().describe('Adresse complète avec étage/code accès'),
  city: z.string().optional().describe('Ville'),
  postalCode: z.string().optional().describe('Code postal'),

  // === PRIORITÉ ===
  priority: z
    .enum(['P0', 'P1', 'P2', 'P3'])
    .optional()
    .describe(
      'Niveau de priorité : P0 si urgence absolue (arrêt cardiaque), P1 si urgence vitale (AVC, détresse respiratoire), P2 si urgence (traumatisme), P3 si non-urgent (symptômes modérés)'
    ),
  priorityReason: z.string().optional().describe('Raison de la priorité (symptômes + gravité)'),

  // === MOTIF & SYMPTÔMES ===
  chiefComplaint: z.string().optional().describe("Motif principal de l'appel"),
  currentSymptoms: z.string().optional().describe('Symptômes actuels détaillés'),

  // === NIVEAU DE CONSCIENCE ===
  consciousness: z
    .string()
    .optional()
    .describe('Niveau de conscience (Alert, Verbal, Pain, Unresponsive)'),
});

export type UpdateCallInfoInput = z.infer<typeof updateCallInfoSchema>;

export interface UpdateCallInfoResponse {
  success: boolean;
  message: string;
  data?: {
    callId: string;
    updated: string[];
  };
}

export async function executeUpdateCallInfo(
  input: UpdateCallInfoInput
): Promise<UpdateCallInfoResponse> {
  // Résoudre le callId depuis conversationId si nécessaire
  let callId = input.callId;

  if (!callId && input.conversation_id) {
    callId = TwilioElevenLabsProxyService.getCallIdFromConversation(input.conversation_id);
    logger.info('Resolved callId from conversationId', {
      conversationId: input.conversation_id,
      callId,
    });
  }

  if (!callId) {
    return {
      success: false,
      message: 'callId ou conversation_id requis',
    };
  }

  logger.info('Executing tool: update_call_info', {
    callId,
    hasPriority: !!input.priority,
    hasAge: !!input.age,
  });

  try {
    const updated: string[] = [];

    // Récupérer l'appel
    const call = await callService.getCallById(callId);

    if (!call) {
      return {
        success: false,
        message: `Appel ${callId} non trouvé`,
      };
    }

    // ===== METTRE À JOUR PATIENT =====
    if (call.patientId) {
      const patientUpdates: Record<string, unknown> = {};

      if (input.age !== undefined) {
        patientUpdates.age = input.age;
        updated.push('age');
      }
      if (input.gender !== undefined) {
        patientUpdates.gender = input.gender;
        updated.push('gender');
      }
      if (input.address !== undefined) {
        patientUpdates.address = input.address;
        updated.push('address');
      }
      if (input.city !== undefined) {
        patientUpdates.city = input.city;
        updated.push('city');
      }
      if (input.postalCode !== undefined) {
        patientUpdates.postalCode = input.postalCode;
        updated.push('postalCode');
      }

      if (Object.keys(patientUpdates).length > 0) {
        await callService.updatePatientInfo(call.patientId, patientUpdates);
      }
    }

    // ===== METTRE À JOUR CALL =====
    const callUpdates: Record<string, unknown> = {};

    if (input.priority !== undefined) {
      callUpdates.priority = input.priority;
      updated.push('priority');
    }
    if (input.priorityReason !== undefined) {
      callUpdates.priorityReason = input.priorityReason;
      updated.push('priorityReason');
    }
    if (input.chiefComplaint !== undefined) {
      callUpdates.chiefComplaint = input.chiefComplaint;
      updated.push('chiefComplaint');
    }
    if (input.currentSymptoms !== undefined) {
      callUpdates.currentSymptoms = input.currentSymptoms;
      updated.push('currentSymptoms');
    }
    if (input.consciousness !== undefined) {
      callUpdates.vitalSigns = { consciousness: input.consciousness };
      updated.push('consciousness');
    }

    if (Object.keys(callUpdates).length > 0) {
      await callService.updateCallFields(callId, callUpdates);
    }

    const response: UpdateCallInfoResponse = {
      success: true,
      message:
        updated.length > 0 ? `✓ Infos enregistrées: ${updated.join(', ')}` : 'Aucune modification',
      data: {
        callId,
        updated,
      },
    };

    logger.info('Tool executed: update_call_info', {
      callId,
      updated: updated.length,
    });

    return response;
  } catch (error) {
    logger.error('Tool failed: update_call_info', error as Error, {
      callId,
    });

    return {
      success: false,
      message: `Erreur: ${(error as Error).message}`,
    };
  }
}
