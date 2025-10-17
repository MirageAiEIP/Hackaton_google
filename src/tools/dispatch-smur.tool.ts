import { z } from 'zod';
import { dispatchService } from '@/services/dispatch.service';
import { logger } from '@/utils/logger';

/**
 * Outil pour dispatcher les secours SMUR (P0/P1)
 * Utilisé par l'agent ElevenLabs via Client Tools
 */
export const dispatchSMURTool = {
  description:
    'Dispatche les secours SMUR pour urgences absolues (P0) ou vitales (P1). À utiliser uniquement pour arrêt cardiaque, AVC, hémorragie massive, détresse respiratoire sévère.',
  parameters: z.object({
    priority: z.enum(['P0', 'P1']).describe("Priorité de l'urgence (P0=absolu, P1=vital)"),
    location: z.string().describe('Adresse complète du patient (rue, ville, code postal)'),
    symptoms: z.string().describe('Description des symptômes urgents'),
    patientPhone: z.string().optional().describe('Numéro de téléphone du patient'),
    callId: z.string().optional().describe("ID de l'appel en cours"),
    latitude: z.number().optional().describe('Latitude GPS'),
    longitude: z.number().optional().describe('Longitude GPS'),
  }),
  execute: async ({
    priority,
    location,
    symptoms,
    patientPhone,
    callId,
    latitude,
    longitude,
  }: {
    priority: 'P0' | 'P1';
    location: string;
    symptoms: string;
    patientPhone?: string;
    callId?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    logger.info('Dispatching SMUR', {
      priority,
      location,
      hasCallId: !!callId,
    });

    try {
      const result = await dispatchService.createDispatch({
        priority,
        location,
        symptoms,
        patientPhone,
        callId,
        latitude,
        longitude,
      });

      const eta = priority === 'P0' ? '5-10 minutes' : '10-20 minutes';

      logger.info('SMUR dispatched successfully', {
        dispatchId: result.dispatch.dispatchId,
        callId: result.callId,
        priority,
      });

      return {
        success: true,
        dispatchId: result.dispatch.dispatchId,
        callId: result.callId,
        eta,
        message: `Les secours SMUR sont en route vers ${location}. Temps d'arrivée estimé: ${eta}. Restez avec le patient et suivez les instructions.`,
      };
    } catch (error) {
      logger.error('SMUR dispatch failed', error as Error, {
        priority,
        location,
      });

      throw new Error(`Impossible de dispatcher le SMUR: ${(error as Error).message}`);
    }
  },
};
