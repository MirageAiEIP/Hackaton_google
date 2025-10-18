import { z } from 'zod';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tool: Get Pharmacy On Duty
 * Called by AI agent to find nearby pharmacies on duty
 * Provides information about 24/7 pharmacies and on-call pharmacies
 */

/**
 * Tool input schema (validated with Zod)
 */
export const getPharmacyOnDutySchema = z.object({
  postalCode: z.string().optional().describe('Patient postal code (e.g., "75001" for Paris)'),
  city: z.string().optional().describe('Patient city name'),
  latitude: z.number().optional().describe('Patient latitude coordinate'),
  longitude: z.number().optional().describe('Patient longitude coordinate'),
});

export type GetPharmacyOnDutyInput = z.infer<typeof getPharmacyOnDutySchema>;

/**
 * Mock pharmacy database
 * In production, this would call an external API (e.g., French government pharmacy API)
 */
const MOCK_PHARMACIES = [
  {
    id: '1',
    name: 'Pharmacie des Champs-Élysées',
    address: '84 Avenue des Champs-Élysées, 75008 Paris',
    phone: '+33 1 45 62 02 41',
    hours: '24/7',
    isOnDuty: true,
    distance: 0.5, // km
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

/**
 * Tool execution function
 * Called when ElevenLabs agent invokes this tool
 */
export async function executeGetPharmacyOnDuty(input: GetPharmacyOnDutyInput) {
  const { postalCode, city, latitude, longitude } = input;

  logger.info('Client Tool: get_pharmacy_on_duty called', {
    postalCode,
    city,
    hasCoordinates: !!(latitude && longitude),
  });

  try {
    // In production, call external API (e.g., Ordre National des Pharmaciens API)
    // For now, return mock data filtered by location

    const pharmacies = MOCK_PHARMACIES;

    // Filter by location if provided
    if (postalCode || city) {
      // In production, filter by actual location
      logger.info('Filtering pharmacies by location', { postalCode, city });
    }

    // Filter only on-duty pharmacies
    const onDutyPharmacies = pharmacies.filter((p) => p.isOnDuty);

    if (onDutyPharmacies.length === 0) {
      return {
        success: true,
        message: 'No pharmacies on duty found nearby',
        data: {
          count: 0,
          pharmacies: [],
          searchArea: postalCode || city || 'current location',
        },
      };
    }

    // Sort by distance (closest first)
    onDutyPharmacies.sort((a, b) => a.distance - b.distance);

    logger.info('Pharmacies on duty found', {
      count: onDutyPharmacies.length,
      location: postalCode || city,
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
        searchArea: postalCode || city || 'current location',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve pharmacies on duty', error as Error, {
      postalCode,
      city,
    });

    return {
      success: false,
      error: 'Failed to retrieve pharmacy information',
      message: 'Internal error occurred while fetching pharmacy data',
    };
  }
}

/**
 * Tool definition for ElevenLabs dashboard configuration
 */
export const getPharmacyOnDutyToolDefinition = {
  name: 'get_pharmacy_on_duty',
  description:
    'Find nearby pharmacies currently on duty (open 24/7 or on-call). Use this when patient needs urgent medication or asks about pharmacy availability. Accepts postal code, city name, or GPS coordinates.',
  parameters: getPharmacyOnDutySchema,
  execute: executeGetPharmacyOnDuty,
};
