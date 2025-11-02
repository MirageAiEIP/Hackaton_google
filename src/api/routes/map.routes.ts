import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ambulanceTrackingService } from '@/services/ambulance-tracking.service';
import { dispatchService } from '@/services/dispatch.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/prisma';

const GetMapDataQuerySchema = z.object({
  lastHours: z.coerce.number().min(1).max(72).optional().default(24),
});

export async function mapRoutes(app: FastifyInstance) {
  /**
   * GET /api/map/data
   * Get all map data (ambulances, dispatches, hospitals) for visualization
   */
  app.get(
    '/data',
    {
      schema: {
        description: 'Get map data for visualization',
        tags: ['Map'],
        querystring: {
          type: 'object',
          properties: {
            lastHours: { type: 'number', minimum: 1, maximum: 72, default: 24 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = GetMapDataQuerySchema.parse(request.query);

        logger.info('Fetching map data', { lastHours: query.lastHours });

        // Get all active ambulances
        const ambulances = await ambulanceTrackingService.getAllActiveAmbulances();

        // Get recent dispatches with locations
        const { dispatches } = await dispatchService.getMapDispatches({
          lastHours: query.lastHours,
        });

        // Get all active hospitals with their ambulances
        const hospitals = await prisma.hospital.findMany({
          where: { isActive: true },
          include: {
            ambulances: {
              where: { isActive: true },
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        logger.info('Map data fetched successfully', {
          ambulances: ambulances.length,
          dispatches: dispatches.length,
          hospitals: hospitals.length,
        });

        return reply.status(200).send({
          ambulances: ambulances.map((amb) => ({
            id: amb.id,
            vehicleId: amb.vehicleId,
            callSign: amb.callSign,
            type: amb.type,
            status: amb.status,
            location: {
              latitude: amb.currentLatitude,
              longitude: amb.currentLongitude,
            },
            heading: amb.heading,
            speed: amb.speed,
            currentDispatchId: amb.currentDispatchId,
            homeHospital: amb.homeHospital,
          })),
          dispatches: dispatches.map((disp) => ({
            id: disp.id,
            dispatchId: disp.dispatchId,
            priority: disp.priority,
            status: disp.status,
            location: {
              latitude: disp.latitude,
              longitude: disp.longitude,
            },
            address: disp.location,
            symptoms: disp.symptoms,
            requestedAt: disp.requestedAt,
            dispatchedAt: disp.dispatchedAt,
            ambulanceId: disp.ambulanceId,
            estimatedArrivalMinutes: disp.estimatedArrivalMinutes,
          })),
          hospitals: hospitals.map((hospital) => {
            const totalAmbulances = hospital.ambulances.length;
            const availableAmbulances = hospital.ambulances.filter(
              (amb) => amb.status === 'AVAILABLE'
            ).length;

            return {
              id: hospital.id,
              name: hospital.name,
              code: hospital.code,
              latitude: hospital.latitude,
              longitude: hospital.longitude,
              address: hospital.address,
              city: hospital.city,
              hasSMUR: hospital.hasSMUR,
              hasEmergencyRoom: hospital.hasEmergencyRoom,
              hasHelicopterPad: hospital.hasHelicopterPad,
              totalAmbulances,
              availableAmbulances,
            };
          }),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to fetch map data', error as Error);
        return reply.code(500).send({
          error: 'Failed to fetch map data',
          message: (error as Error).message,
        });
      }
    }
  );

  /**
   * GET /api/map/ambulances
   * Get all active ambulances
   */
  app.get(
    '/ambulances',
    {
      schema: {
        description: 'Get all active ambulances',
        tags: ['Map', 'Ambulances'],
      },
    },
    async (_request, reply) => {
      try {
        const ambulances = await ambulanceTrackingService.getAllActiveAmbulances();

        return reply.status(200).send({
          ambulances: ambulances.map((amb) => ({
            id: amb.id,
            vehicleId: amb.vehicleId,
            callSign: amb.callSign,
            type: amb.type,
            status: amb.status,
            location: {
              latitude: amb.currentLatitude,
              longitude: amb.currentLongitude,
            },
            heading: amb.heading,
            speed: amb.speed,
            currentDispatchId: amb.currentDispatchId,
            homeHospital: amb.homeHospital,
          })),
          count: ambulances.length,
        });
      } catch (error) {
        logger.error('Failed to fetch ambulances', error as Error);
        return reply.code(500).send({
          error: 'Failed to fetch ambulances',
        });
      }
    }
  );

  /**
   * GET /api/map/dispatches
   * Get active dispatches for map
   */
  app.get(
    '/dispatches',
    {
      schema: {
        description: 'Get active dispatches for map',
        tags: ['Map', 'Dispatches'],
        querystring: {
          type: 'object',
          properties: {
            lastHours: { type: 'number', minimum: 1, maximum: 72, default: 24 },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = GetMapDataQuerySchema.parse(request.query);
        const { dispatches } = await dispatchService.getMapDispatches({
          lastHours: query.lastHours,
        });

        return reply.status(200).send({
          dispatches: dispatches.map((disp) => ({
            id: disp.id,
            dispatchId: disp.dispatchId,
            priority: disp.priority,
            status: disp.status,
            location: {
              latitude: disp.latitude,
              longitude: disp.longitude,
            },
            address: disp.location,
            symptoms: disp.symptoms,
            requestedAt: disp.requestedAt,
            dispatchedAt: disp.dispatchedAt,
            ambulanceId: disp.ambulanceId,
            estimatedArrivalMinutes: disp.estimatedArrivalMinutes,
          })),
          count: dispatches.length,
        });
      } catch (error) {
        logger.error('Failed to fetch dispatches', error as Error);
        return reply.code(500).send({
          error: 'Failed to fetch dispatches',
        });
      }
    }
  );

  /**
   * GET /api/map/hospitals
   * Get all hospitals
   */
  app.get(
    '/hospitals',
    {
      schema: {
        description: 'Get all active hospitals',
        tags: ['Map', 'Hospitals'],
      },
    },
    async (_request, reply) => {
      try {
        const hospitals = await prisma.hospital.findMany({
          where: { isActive: true },
          include: {
            ambulances: {
              where: { isActive: true },
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        const hospitalsWithCounts = hospitals.map((hospital) => {
          const totalAmbulances = hospital.ambulances.length;
          const availableAmbulances = hospital.ambulances.filter(
            (amb) => amb.status === 'AVAILABLE'
          ).length;

          return {
            id: hospital.id,
            name: hospital.name,
            code: hospital.code,
            latitude: hospital.latitude,
            longitude: hospital.longitude,
            address: hospital.address,
            city: hospital.city,
            postalCode: hospital.postalCode,
            phone: hospital.phone,
            hasSMUR: hospital.hasSMUR,
            hasEmergencyRoom: hospital.hasEmergencyRoom,
            hasHelicopterPad: hospital.hasHelicopterPad,
            totalAmbulances,
            availableAmbulances,
          };
        });

        return reply.status(200).send({
          hospitals: hospitalsWithCounts,
          count: hospitalsWithCounts.length,
        });
      } catch (error) {
        logger.error('Failed to fetch hospitals', error as Error);
        return reply.code(500).send({
          error: 'Failed to fetch hospitals',
        });
      }
    }
  );
}
