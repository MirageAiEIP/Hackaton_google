import { z } from 'zod';
import { callService } from '@/services/call.service';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tool: update_call_info
 *
 * Tool UNIFIÉ pour mettre à jour TOUTES les informations de l'appel :
 * - Infos patient (age, gender, address, city, postalCode)
 * - Priorité (priority, priorityReason)
 * - Infos médicales (chiefComplaint, currentSymptoms, vitalSigns, contextInfo)
 *
 * USAGE:
 * - Agent 1 (ARM) : Appelle avec infos admin + priorité après classification
 * - Agent 2 (Medical) : Appelle avec infos médicales approfondies + peut écraser
 *
 * Tous les champs sont optionnels - seuls les champs fournis sont mis à jour.
 */

export const updateCallInfoSchema = z.object({
  callId: z.string().describe("ID de l'appel"),

  // ===== INFOS PATIENT (ADMIN) =====
  patientInfo: z
    .object({
      age: z.number().optional().describe('Âge du patient'),
      gender: z.string().optional().describe('Sexe (M/F/Autre)'),
      address: z.string().optional().describe('Adresse complète avec étage/code'),
      city: z.string().optional().describe('Ville'),
      postalCode: z.string().optional().describe('Code postal'),
    })
    .optional()
    .describe("Informations d'identité et localisation du patient"),

  // ===== PRIORITÉ (CLASSIFICATION ABCD) =====
  priority: z
    .enum(['P0', 'P1', 'P2', 'P3'])
    .optional()
    .describe('Niveau de priorité après classification ABCD'),
  priorityReason: z
    .string()
    .optional()
    .describe('Raison détaillée de la classification (symptômes + terrain + suspicion)'),

  // ===== MOTIF & SYMPTÔMES =====
  chiefComplaint: z.string().optional().describe("Motif principal de l'appel"),
  currentSymptoms: z.string().optional().describe('Description détaillée des symptômes actuels'),

  // ===== SIGNES VITAUX =====
  vitalSigns: z
    .object({
      heartRate: z.number().optional().describe('Fréquence cardiaque (bpm)'),
      bloodPressure: z.string().optional().describe('Tension artérielle (ex: 140/90)'),
      temperature: z.number().optional().describe('Température (°C)'),
      oxygenSaturation: z.number().optional().describe('Saturation O2 (%)'),
      respiratoryRate: z.number().optional().describe('Fréquence respiratoire (/min)'),
      consciousness: z
        .string()
        .optional()
        .describe('État de conscience (AVPU: Alert, Verbal, Pain, Unresponsive)'),
    })
    .optional()
    .describe('Signes vitaux du patient'),

  // ===== CONTEXTE SYMPTÔMES =====
  contextInfo: z
    .object({
      symptomDuration: z.string().optional().describe('Durée des symptômes (ex: "45 minutes")'),
      symptomOnset: z
        .string()
        .optional()
        .describe('Début des symptômes (ex: "Brutal", "Progressif")'),
      evolution: z
        .string()
        .optional()
        .describe('Évolution (ex: "Stable", "Aggravation", "Amélioration")'),
      associatedSymptoms: z
        .array(z.string())
        .optional()
        .describe('Symptômes associés (ex: ["Sueurs", "Nausées"])'),
      aggravatingFactors: z
        .array(z.string())
        .optional()
        .describe('Facteurs aggravants (ex: ["Effort", "Stress"])'),
      relievingFactors: z
        .array(z.string())
        .optional()
        .describe('Facteurs soulageants (ex: ["Repos", "Position assise"])'),
    })
    .optional()
    .describe('Contexte et évolution des symptômes'),
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
  logger.info('Executing tool: update_call_info', {
    callId: input.callId,
    hasPatientInfo: !!input.patientInfo,
    hasPriority: !!input.priority,
    hasVitalSigns: !!input.vitalSigns,
  });

  try {
    const updated: string[] = [];

    // Récupérer l'appel
    const call = await callService.getCallById(input.callId);

    if (!call) {
      return {
        success: false,
        message: `Appel ${input.callId} non trouvé`,
      };
    }

    // ===== METTRE À JOUR INFOS PATIENT =====
    if (input.patientInfo && call.patientId) {
      const patientUpdates: Record<string, unknown> = {};

      if (input.patientInfo.age !== undefined) {
        patientUpdates.age = input.patientInfo.age;
        updated.push('age');
      }
      if (input.patientInfo.gender !== undefined) {
        patientUpdates.gender = input.patientInfo.gender;
        updated.push('gender');
      }
      if (input.patientInfo.address !== undefined) {
        patientUpdates.address = input.patientInfo.address;
        updated.push('address');
      }
      if (input.patientInfo.city !== undefined) {
        patientUpdates.city = input.patientInfo.city;
        updated.push('city');
      }
      if (input.patientInfo.postalCode !== undefined) {
        patientUpdates.postalCode = input.patientInfo.postalCode;
        updated.push('postalCode');
      }

      if (Object.keys(patientUpdates).length > 0) {
        await callService.updatePatientInfo(call.patientId, patientUpdates);
        logger.info('Patient info updated', {
          patientId: call.patientId,
          fields: Object.keys(patientUpdates),
        });
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
    if (input.vitalSigns !== undefined) {
      callUpdates.vitalSigns = input.vitalSigns;
      updated.push('vitalSigns');
    }
    if (input.contextInfo !== undefined) {
      callUpdates.contextInfo = input.contextInfo;
      updated.push('contextInfo');
    }

    if (Object.keys(callUpdates).length > 0) {
      await callService.updateCallFields(input.callId, callUpdates);
      logger.info('Call info updated', {
        callId: input.callId,
        fields: Object.keys(callUpdates),
        priority: input.priority,
      });
    }

    const response: UpdateCallInfoResponse = {
      success: true,
      message:
        updated.length > 0
          ? `Informations mises à jour: ${updated.join(', ')}`
          : 'Aucune modification',
      data: {
        callId: input.callId,
        updated,
      },
    };

    logger.info('Tool executed successfully: update_call_info', {
      callId: input.callId,
      updatedFields: updated.length,
    });

    return response;
  } catch (error) {
    logger.error('Tool execution failed: update_call_info', error as Error, {
      callId: input.callId,
    });

    return {
      success: false,
      message: `Erreur lors de la mise à jour: ${(error as Error).message}`,
    };
  }
}
