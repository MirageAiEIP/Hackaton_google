import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { AmbulanceLocationUpdatedEvent } from '@/domain/ambulance/events/AmbulanceLocationUpdated.event';
import { prisma } from '@/utils/prisma';
import { IEventBus } from '@/domain/shared/IEventBus';
import { AmbulanceStatus } from '@prisma/client';

interface SimulateAmbulanceMovementBody {
  ambulanceId?: string;
  duration?: number; // in seconds
  updateInterval?: number; // in milliseconds
}

/**
 * Simulator routes for testing real-time features
 * WARNING: These endpoints should be disabled in production
 */
export async function simulatorRoutes(app: FastifyInstance) {
  // Lazy load eventBus to avoid initialization issues in tests
  const getEventBus = () => {
    const container = Container.getInstance();
    return container.getEventBus();
  };

  /**
   * Simulate ambulance movement along a route
   * This endpoint will publish location updates for testing
   */
  app.post<{ Body: SimulateAmbulanceMovementBody }>(
    '/simulate-movement',
    {
      schema: {
        tags: ['simulator'],
        summary: 'Simulate ambulance movement (DEV ONLY)',
        description: 'Simulates an ambulance moving along a route by publishing location updates',
        body: {
          type: 'object',
          properties: {
            ambulanceId: {
              type: 'string',
              description:
                'Ambulance ID to simulate. If not provided, uses first available ambulance',
            },
            duration: {
              type: 'number',
              description: 'Duration of simulation in seconds (default: 60)',
              default: 60,
            },
            updateInterval: {
              type: 'number',
              description: 'Interval between updates in milliseconds (default: 2000)',
              default: 2000,
            },
          },
        },
        response: {
          200: {
            description: 'Simulation started',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              ambulanceId: { type: 'string' },
              duration: { type: 'number' },
              updateInterval: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SimulateAmbulanceMovementBody }>,
      reply: FastifyReply
    ) => {
      const { ambulanceId, duration = 60, updateInterval = 2000 } = request.body;

      try {
        // Get ambulance
        let ambulance;
        if (ambulanceId) {
          ambulance = await prisma.ambulance.findUnique({
            where: { id: ambulanceId },
          });
        } else {
          // Get first available ambulance
          ambulance = await prisma.ambulance.findFirst({
            where: { isActive: true },
          });
        }

        if (!ambulance) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'AMBULANCE_NOT_FOUND',
              message: 'No ambulance found for simulation',
            },
          });
        }

        logger.info('Starting ambulance movement simulation', {
          ambulanceId: ambulance.id,
          duration,
          updateInterval,
        });

        // Start simulation in background
        simulateAmbulanceMovement(
          ambulance.id,
          ambulance.currentLatitude || 48.8566,
          ambulance.currentLongitude || 2.3522,
          duration,
          updateInterval,
          getEventBus()
        );

        return {
          success: true,
          message: 'Ambulance movement simulation started',
          ambulanceId: ambulance.id,
          duration,
          updateInterval,
        };
      } catch (error) {
        logger.error('Failed to start simulation', error as Error);
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SIMULATION_ERROR',
            message: 'Failed to start simulation',
          },
        });
      }
    }
  );

  /**
   * Stop all active simulations
   */
  app.post(
    '/stop-simulations',
    {
      schema: {
        tags: ['simulator'],
        summary: 'Stop all simulations (DEV ONLY)',
        description: 'Stops all active ambulance movement simulations',
      },
    },
    async () => {
      activeSimulations.forEach((timeout) => clearTimeout(timeout));
      activeSimulations.clear();

      logger.info('All simulations stopped');

      return {
        success: true,
        message: 'All simulations stopped',
      };
    }
  );
}

// Track active simulations for cleanup
const activeSimulations = new Set<NodeJS.Timeout>();

/**
 * Simulate ambulance movement by publishing location updates
 */
function simulateAmbulanceMovement(
  ambulanceId: string,
  startLat: number,
  startLng: number,
  durationSeconds: number,
  updateIntervalMs: number,
  eventBus: IEventBus
) {
  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;
  let currentLat = startLat;
  let currentLng = startLng;
  let heading = Math.random() * 360; // Random initial heading

  const simulate = async () => {
    if (Date.now() >= endTime) {
      logger.info('Simulation completed', { ambulanceId });
      return;
    }

    // Simulate movement: move in current direction with some randomness
    const speed = 50 + Math.random() * 30; // Speed in km/h (50-80 km/h)
    const distanceKm = (speed / 3600) * (updateIntervalMs / 1000); // Distance traveled in this interval

    // Add some randomness to heading (±15 degrees)
    heading += (Math.random() - 0.5) * 30;
    if (heading < 0) {
      heading += 360;
    }
    if (heading >= 360) {
      heading -= 360;
    }

    // Convert heading to radians and calculate new position
    const headingRad = (heading * Math.PI) / 180;
    const earthRadiusKm = 6371;

    // Calculate new latitude and longitude
    const deltaLat = (distanceKm / earthRadiusKm) * (180 / Math.PI) * Math.cos(headingRad);
    const deltaLng =
      (distanceKm / (earthRadiusKm * Math.cos((currentLat * Math.PI) / 180))) *
      (180 / Math.PI) *
      Math.sin(headingRad);

    currentLat += deltaLat;
    currentLng += deltaLng;

    // Keep within Paris bounds (roughly)
    currentLat = Math.max(48.815, Math.min(48.902, currentLat));
    currentLng = Math.max(2.225, Math.min(2.47, currentLng));

    // Publish location update event
    const event = new AmbulanceLocationUpdatedEvent(
      ambulanceId,
      {
        latitude: currentLat,
        longitude: currentLng,
      },
      AmbulanceStatus.EN_ROUTE,
      Math.round(heading),
      Math.round(speed),
      undefined
    );

    try {
      await eventBus.publish(event);

      // Update database
      await prisma.ambulance.update({
        where: { id: ambulanceId },
        data: {
          currentLatitude: currentLat,
          currentLongitude: currentLng,
          heading: Math.round(heading),
          speed: Math.round(speed),
        },
      });

      logger.debug('Published simulated location update', {
        ambulanceId,
        lat: currentLat.toFixed(6),
        lng: currentLng.toFixed(6),
        heading: Math.round(heading),
        speed: Math.round(speed),
      });
    } catch (error) {
      logger.error('Failed to publish location update', error as Error, { ambulanceId });
    }

    // Schedule next update
    const timeout = setTimeout(simulate, updateIntervalMs);
    activeSimulations.add(timeout);
  };

  // Start simulation
  simulate();
}
