import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { AmbulanceStatus, AmbulanceType, Prisma } from '@prisma/client';
import { Container } from '@/infrastructure/di/Container';
import { AmbulanceLocationUpdatedEvent } from '@/domain/ambulance/events/AmbulanceLocationUpdated.event';
import { AmbulanceDispatchedEvent } from '@/domain/ambulance/events/AmbulanceDispatched.event';

export interface CreateAmbulanceInput {
  vehicleId: string;
  callSign: string;
  licensePlate: string;
  type: AmbulanceType;
  homeHospitalId: string;
  currentLatitude: number;
  currentLongitude: number;
  hasDoctor?: boolean;
  hasParamedic?: boolean;
  crewNames?: string[];
  driverName?: string;
}

export interface UpdateAmbulanceLocationInput {
  ambulanceId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  status: AmbulanceStatus;
  dispatchId?: string;
}

export interface AssignAmbulanceToDispatchInput {
  dispatchId: string;
  patientLatitude: number;
  patientLongitude: number;
  priority: string;
}

export class AmbulanceTrackingService {
  private movementIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new ambulance in the fleet
   */
  async createAmbulance(input: CreateAmbulanceInput) {
    logger.info('Creating ambulance', { vehicleId: input.vehicleId });

    try {
      const ambulance = await prisma.ambulance.create({
        data: {
          vehicleId: input.vehicleId,
          callSign: input.callSign,
          licensePlate: input.licensePlate,
          type: input.type,
          homeHospitalId: input.homeHospitalId,
          currentLatitude: input.currentLatitude,
          currentLongitude: input.currentLongitude,
          hasDoctor: input.hasDoctor ?? (input.type === 'SMUR' || input.type === 'MEDICALISED'),
          hasParamedic: input.hasParamedic ?? true,
          crewNames: input.crewNames ?? [],
          driverName: input.driverName,
          status: 'AVAILABLE',
        },
        include: {
          homeHospital: true,
        },
      });

      logger.info('Ambulance created', { id: ambulance.id, vehicleId: ambulance.vehicleId });
      return ambulance;
    } catch (error) {
      logger.error('Failed to create ambulance', error as Error, { vehicleId: input.vehicleId });
      throw new Error('Failed to create ambulance');
    }
  }

  /**
   * Find the nearest available ambulance to a location
   */
  async findNearestAvailableAmbulance(latitude: number, longitude: number, type?: AmbulanceType) {
    logger.info('Finding nearest ambulance', { latitude, longitude, type });

    try {
      // Use raw SQL for distance calculation with PostGIS
      // For now, use simple Euclidean distance (will be more accurate with PostGIS)
      const where: Prisma.AmbulanceWhereInput = {
        status: 'AVAILABLE',
        isActive: true,
      };

      if (type) {
        where.type = type;
      }

      const ambulances = await prisma.ambulance.findMany({
        where,
        include: {
          homeHospital: true,
        },
      });

      if (ambulances.length === 0) {
        logger.warn('No available ambulances found', { type });
        return null;
      }

      // Calculate distance for each ambulance (simplified haversine)
      const ambulancesWithDistance = ambulances.map((ambulance) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          ambulance.currentLatitude,
          ambulance.currentLongitude
        );
        return { ambulance, distance };
      });

      // Sort by distance and return closest
      ambulancesWithDistance.sort((a, b) => a.distance - b.distance);
      const nearest = ambulancesWithDistance[0];

      if (!nearest) {
        logger.warn('No ambulances available after sorting');
        return null;
      }

      logger.info('Nearest ambulance found', {
        vehicleId: nearest.ambulance.vehicleId,
        distance: nearest.distance,
      });

      return { ...nearest.ambulance, distanceKm: nearest.distance };
    } catch (error) {
      logger.error('Failed to find nearest ambulance', error as Error, {
        latitude,
        longitude,
      });
      throw new Error('Failed to find nearest ambulance');
    }
  }

  /**
   * Assign an ambulance to a dispatch and start simulation
   */
  async assignAmbulanceToDispatch(input: AssignAmbulanceToDispatchInput) {
    const { dispatchId, patientLatitude, patientLongitude, priority } = input;

    logger.info('Assigning ambulance to dispatch', { dispatchId });

    try {
      // Find nearest available SMUR for P0/P1 priorities
      const requiredType = priority === 'P0' || priority === 'P1' ? 'SMUR' : undefined;
      const nearestAmbulance = await this.findNearestAvailableAmbulance(
        patientLatitude,
        patientLongitude,
        requiredType
      );

      if (!nearestAmbulance) {
        throw new Error('No available ambulances found');
      }

      // Calculate ETA
      const distanceKm = nearestAmbulance.distanceKm || 0;
      const estimatedMinutes = Math.ceil((distanceKm / 60) * 60); // Assume 60 km/h average speed

      // Update ambulance status and dispatch
      const [updatedAmbulance, updatedDispatch] = await prisma.$transaction([
        prisma.ambulance.update({
          where: { id: nearestAmbulance.id },
          data: {
            status: 'DISPATCHED',
            currentDispatchId: dispatchId,
          },
        }),
        prisma.dispatch.update({
          where: { dispatchId },
          data: {
            ambulanceId: nearestAmbulance.id,
            status: 'DISPATCHED',
            dispatchedAt: new Date(),
            distanceKm,
            estimatedArrivalMinutes: estimatedMinutes,
          },
        }),
      ]);

      logger.info('Ambulance assigned to dispatch', {
        ambulanceId: nearestAmbulance.id,
        dispatchId,
        distanceKm,
        estimatedMinutes,
      });

      // Publish event for real-time updates
      const container = Container.getInstance();
      const eventBus = container.getEventBus();
      await eventBus.publish(
        new AmbulanceDispatchedEvent(
          updatedAmbulance.id,
          dispatchId,
          {
            latitude: updatedAmbulance.currentLatitude,
            longitude: updatedAmbulance.currentLongitude,
          },
          { latitude: patientLatitude, longitude: patientLongitude },
          estimatedMinutes
        )
      );

      // Start movement simulation
      this.startAmbulanceMovementSimulation(
        updatedAmbulance.id,
        updatedAmbulance.currentLatitude,
        updatedAmbulance.currentLongitude,
        patientLatitude,
        patientLongitude,
        dispatchId
      );

      return {
        ambulance: updatedAmbulance,
        dispatch: updatedDispatch,
        estimatedArrivalMinutes: estimatedMinutes,
        distanceKm,
      };
    } catch (error) {
      logger.error('Failed to assign ambulance', error as Error, { dispatchId });
      throw error;
    }
  }

  /**
   * Simulate ambulance movement from current location to destination
   */
  private startAmbulanceMovementSimulation(
    ambulanceId: string,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    dispatchId: string,
    isReturning: boolean = false
  ) {
    logger.info('Starting ambulance movement simulation', { ambulanceId, dispatchId });

    // Clear any existing simulation for this ambulance
    this.stopAmbulanceMovementSimulation(ambulanceId);

    const startTime = Date.now();
    const totalDistance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
    const averageSpeedKmh = 60; // 60 km/h average speed
    const totalDurationMs = (totalDistance / averageSpeedKmh) * 3600 * 1000;

    // Update position every 0.2 seconds for very smooth movement
    const interval = setInterval(async () => {
      try {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalDurationMs, 1);

        // Linear interpolation between start and end points
        const currentLat = fromLat + (toLat - fromLat) * progress;
        const currentLng = fromLng + (toLng - fromLng) * progress;

        // Calculate heading (bearing)
        const heading = this.calculateBearing(fromLat, fromLng, toLat, toLng);

        // Update ambulance location
        await this.updateAmbulanceLocation({
          ambulanceId,
          latitude: currentLat,
          longitude: currentLng,
          heading,
          speed: averageSpeedKmh,
          status: progress < 1 ? 'EN_ROUTE' : 'ON_SCENE',
          dispatchId,
        });

        // If reached destination, stop simulation
        if (progress >= 1) {
          this.stopAmbulanceMovementSimulation(ambulanceId);

          if (isReturning) {
            // Returned to hospital - set back to AVAILABLE
            logger.info('Ambulance returned to hospital', { ambulanceId, dispatchId });
            await prisma.ambulance.update({
              where: { id: ambulanceId },
              data: {
                status: 'AVAILABLE',
                speed: 0,
                currentDispatchId: null,
              },
            });
          } else {
            // Arrived at patient location
            logger.info('Ambulance reached destination', { ambulanceId, dispatchId });

            // Update dispatch status
            await prisma.dispatch.update({
              where: { dispatchId },
              data: {
                status: 'ON_SCENE',
                arrivedAt: new Date(),
              },
            });

            // Update ambulance status
            await prisma.ambulance.update({
              where: { id: ambulanceId },
              data: {
                status: 'ON_SCENE',
                speed: 0,
              },
            });

            // Schedule return to hospital after 30 seconds
            setTimeout(() => {
              this.returnAmbulanceToHospital(ambulanceId, dispatchId);
            }, 30000); // 30 seconds on scene
          }
        }
      } catch (error) {
        logger.error('Error in ambulance movement simulation', error as Error, {
          ambulanceId,
        });
        this.stopAmbulanceMovementSimulation(ambulanceId);
      }
    }, 200); // Update every 0.2 seconds for very smooth movement

    this.movementIntervals.set(ambulanceId, interval);
  }

  /**
   * Stop movement simulation for an ambulance
   */
  private stopAmbulanceMovementSimulation(ambulanceId: string) {
    const interval = this.movementIntervals.get(ambulanceId);
    if (interval) {
      clearInterval(interval);
      this.movementIntervals.delete(ambulanceId);
      logger.info('Stopped ambulance movement simulation', { ambulanceId });
    }
  }

  /**
   * Return ambulance to its home hospital after completing dispatch
   */
  private async returnAmbulanceToHospital(ambulanceId: string, dispatchId: string) {
    try {
      logger.info('Returning ambulance to hospital', { ambulanceId, dispatchId });

      // Get ambulance with current location and home hospital
      const ambulance = await prisma.ambulance.findUnique({
        where: { id: ambulanceId },
        include: { homeHospital: true },
      });

      if (!ambulance) {
        logger.warn('Ambulance not found for return', { ambulanceId });
        return;
      }

      // Update dispatch to completed
      await prisma.dispatch.update({
        where: { dispatchId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Update ambulance status to returning
      await prisma.ambulance.update({
        where: { id: ambulanceId },
        data: {
          status: 'RETURNING',
          currentDispatchId: null,
        },
      });

      // Start movement back to hospital
      this.startAmbulanceMovementSimulation(
        ambulanceId,
        ambulance.currentLatitude,
        ambulance.currentLongitude,
        ambulance.homeHospital.latitude,
        ambulance.homeHospital.longitude,
        dispatchId,
        true // isReturning flag
      );
    } catch (error) {
      logger.error('Error returning ambulance to hospital', error as Error, {
        ambulanceId,
        dispatchId,
      });
    }
  }

  /**
   * Update ambulance location and broadcast to clients
   */
  async updateAmbulanceLocation(input: UpdateAmbulanceLocationInput) {
    const { ambulanceId, latitude, longitude, heading, speed, status, dispatchId } = input;

    try {
      // Update ambulance current location
      const ambulance = await prisma.ambulance.update({
        where: { id: ambulanceId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          heading: heading ?? 0,
          speed: speed ?? 0,
          status,
        },
      });

      // Record location in history
      await prisma.ambulanceLocation.create({
        data: {
          ambulanceId,
          latitude,
          longitude,
          heading: heading ?? 0,
          speed: speed ?? 0,
          status,
          dispatchId,
        },
      });

      // Publish event for real-time updates
      const container = Container.getInstance();
      const eventBus = container.getEventBus();
      await eventBus.publish(
        new AmbulanceLocationUpdatedEvent(
          ambulanceId,
          { latitude, longitude },
          status,
          heading ?? 0,
          speed ?? 0,
          dispatchId
        )
      );

      return ambulance;
    } catch (error) {
      logger.error('Failed to update ambulance location', error as Error, {
        ambulanceId,
      });
      // Don't throw - allow simulation to continue
      return undefined;
    }
  }

  /**
   * Get all active ambulances with their current locations
   */
  async getAllActiveAmbulances() {
    logger.info('Getting all active ambulances');

    try {
      const ambulances = await prisma.ambulance.findMany({
        where: {
          isActive: true,
        },
        include: {
          homeHospital: {
            select: {
              id: true,
              name: true,
              code: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: {
          vehicleId: 'asc',
        },
      });

      logger.info('Active ambulances retrieved', { count: ambulances.length });
      return ambulances;
    } catch (error) {
      logger.error('Failed to get active ambulances', error as Error);
      throw new Error('Failed to get active ambulances');
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate bearing (heading) between two coordinates
   * Returns bearing in degrees (0-360)
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(this.toRadians(lat2));
    const x =
      Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
      Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Clean up all movement simulations (call on shutdown)
   */
  cleanup() {
    logger.info('Cleaning up ambulance movement simulations');
    for (const [ambulanceId, interval] of this.movementIntervals) {
      clearInterval(interval);
      logger.info('Stopped simulation for ambulance', { ambulanceId });
    }
    this.movementIntervals.clear();
  }
}

export const ambulanceTrackingService = new AmbulanceTrackingService();
