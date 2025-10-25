import { z } from 'zod';
import { logger } from '@/utils/logger';

export const getPharmacyOnDutySchema = z.object({
  conversation_id: z.string().optional().describe('ElevenLabs conversation ID'),
  postalCode: z.string().optional().describe('Patient postal code'),
  city: z.string().optional().describe('Patient city name'),
});

export type GetPharmacyOnDutyInput = z.infer<typeof getPharmacyOnDutySchema>;

const MOCK_PHARMACIES = [
  {
    id: '1',
    name: 'Pharmacie des Champs-Élysées',
    address: '84 Avenue des Champs-Élysées, 75008 Paris',
    phone: '+33 1 45 62 02 41',
    hours: '24/7',
    isOnDuty: true,
    distance: 0.5,
  },
  {
    id: '2',
    name: 'Pharmacie Européenne',
    address: '6 Place de Clichy, 75009 Paris',
    phone: '+33 1 48 74 65 18',
    hours: '00:00 - 24:00',
    isOnDuty: true,
    distance: 1.2,
  },
  {
    id: '3',
    name: 'Pharmacie de la Gare',
    address: 'Gare du Nord, 75010 Paris',
    phone: '+33 1 48 78 15 33',
    hours: '07:00 - 23:00',
    isOnDuty: false,
    distance: 2.3,
  },
];

export async function executeGetPharmacyOnDuty(input: GetPharmacyOnDutyInput) {
  logger.info('Client Tool: get_pharmacy_on_duty called', {
    conversation_id: input.conversation_id,
    postalCode: input.postalCode,
    city: input.city,
  });

  try {
    const pharmacies = MOCK_PHARMACIES;

    if (input.postalCode || input.city) {
      logger.info('Filtering pharmacies by location', {
        postalCode: input.postalCode,
        city: input.city,
      });
    }

    const onDutyPharmacies = pharmacies.filter((p) => p.isOnDuty);

    if (onDutyPharmacies.length === 0) {
      return {
        success: true,
        message: 'No pharmacies on duty found nearby',
        data: {
          count: 0,
          pharmacies: [],
          searchArea: input.postalCode || input.city || 'current location',
        },
      };
    }

    onDutyPharmacies.sort((a, b) => a.distance - b.distance);

    logger.info('Pharmacies on duty found', {
      count: onDutyPharmacies.length,
      location: input.postalCode || input.city,
    });

    return {
      success: true,
      message: `Found ${onDutyPharmacies.length} pharmacy(ies) on duty nearby`,
      data: {
        count: onDutyPharmacies.length,
        pharmacies: onDutyPharmacies.map((p) => ({
          name: p.name,
          address: p.address,
          phone: p.phone,
          hours: p.hours,
          distance: `${p.distance} km`,
        })),
        searchArea: input.postalCode || input.city || 'current location',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve pharmacies on duty', error as Error, {
      postalCode: input.postalCode,
      city: input.city,
    });

    return {
      success: false,
      error: 'Failed to retrieve pharmacy information',
      message: 'Internal error occurred while fetching pharmacy data',
    };
  }
}

export const getPharmacyOnDutyToolDefinition = {
  name: 'get_pharmacy_on_duty',
  description:
    'Find nearby pharmacies currently on duty (open 24/7 or on-call). Use this when patient needs urgent medication or asks about pharmacy availability. Accepts postal code, city name, or GPS coordinates.',
  parameters: getPharmacyOnDutySchema,
  execute: executeGetPharmacyOnDuty,
};
