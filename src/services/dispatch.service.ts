import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { PriorityLevel, DispatchStatus, Prisma } from '@prisma/client';

export interface CreateDispatchInput {
  priority: PriorityLevel;
  location: string;
  symptoms: string;
  patientPhone?: string;
  callId?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateDispatchStatusInput {
  dispatchId: string;
  status: DispatchStatus;
  dispatchedAt?: Date;
  arrivedAt?: Date;
  completedAt?: Date;
}

export class DispatchService {
  async createDispatch(input: CreateDispatchInput) {
    const { priority, location, symptoms, patientPhone, callId, latitude, longitude } = input;

    if (priority !== 'P0' && priority !== 'P1') {
      throw new Error('Only P0 and P1 priorities can dispatch SMUR');
    }

    logger.info('Creating SMUR dispatch', { priority, location, hasCallId: !!callId });

    try {
      let finalCallId = callId;
      if (!finalCallId) {
        const call = await prisma.call.create({
          data: {
            status: 'IN_PROGRESS',
            transcript: `Dispatch SMUR: ${symptoms}`,
          },
        });
        finalCallId = call.id;
        logger.info('Call created', { callId: finalCallId });
      }

      const dispatchId = `SMUR-${Date.now()}`;
      const dispatch = await prisma.dispatch.create({
        data: {
          callId: finalCallId,
          dispatchId,
          priority,
          location,
          symptoms,
          patientPhone,
          latitude,
          longitude,
          status: 'PENDING',
        },
        include: {
          call: true,
        },
      });

      logger.info('SMUR dispatch created', { dispatchId, id: dispatch.id, callId: finalCallId });

      return {
        dispatch,
        callId: finalCallId,
      };
    } catch (error) {
      logger.error('Failed to create dispatch', error as Error, { priority, location });
      throw new Error('Failed to create SMUR dispatch');
    }
  }

  async updateDispatchStatus(input: UpdateDispatchStatusInput) {
    const { dispatchId, status, dispatchedAt, arrivedAt, completedAt } = input;

    logger.info('Updating dispatch status', {
      dispatchId,
      status,
    });

    try {
      const dispatch = await prisma.dispatch.update({
        where: { dispatchId },
        data: {
          status,
          ...(dispatchedAt && { dispatchedAt }),
          ...(arrivedAt && { arrivedAt }),
          ...(completedAt && { completedAt }),
        },
      });

      // Calculer le temps de réponse si complété
      if (status === 'COMPLETED' && completedAt && dispatch.requestedAt) {
        const responseTime = Math.floor(
          (completedAt.getTime() - dispatch.requestedAt.getTime()) / 1000
        );
        await prisma.dispatch.update({
          where: { dispatchId },
          data: { responseTime },
        });
      }

      logger.info('Dispatch status updated', {
        dispatchId,
        status,
      });

      return dispatch;
    } catch (error) {
      logger.error('Failed to update dispatch status', error as Error, {
        dispatchId,
        status,
      });
      throw new Error('Failed to update dispatch status');
    }
  }

  async listDispatches(filters?: {
    status?: DispatchStatus;
    priority?: PriorityLevel;
    sinceHours?: number;
  }) {
    logger.info('Listing dispatches', { filters });

    try {
      const where: Prisma.DispatchWhereInput = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      if (filters?.sinceHours) {
        const since = new Date(Date.now() - filters.sinceHours * 60 * 60 * 1000);
        where.createdAt = { gte: since };
      }

      const dispatches = await prisma.dispatch.findMany({
        where,
        include: {
          call: {
            include: {
              patient: true,
              triageReport: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      logger.info('Dispatches retrieved', { count: dispatches.length });

      return dispatches;
    } catch (error) {
      logger.error('Failed to list dispatches', error as Error, { filters });
      throw new Error('Failed to list dispatches');
    }
  }

  async getMapDispatches(filters?: {
    status?: DispatchStatus;
    priority?: PriorityLevel;
    lastHours?: number;
  }) {
    const lastHours = filters?.lastHours || 24;
    const since = new Date(Date.now() - lastHours * 60 * 60 * 1000);

    logger.info('Getting map dispatches', { filters, lastHours });

    try {
      const where: Prisma.DispatchWhereInput = {
        createdAt: { gte: since },
        latitude: { not: null },
        longitude: { not: null },
      };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      const dispatches = await prisma.dispatch.findMany({
        where,
        include: {
          call: {
            include: {
              triageReport: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const geoJson = {
        type: 'FeatureCollection' as const,
        features: dispatches.map((dispatch) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [dispatch.longitude!, dispatch.latitude!],
          },
          properties: {
            id: dispatch.id,
            dispatchId: dispatch.dispatchId,
            priority: dispatch.priority,
            status: dispatch.status,
            location: dispatch.location,
            symptoms: dispatch.symptoms,
            requestedAt: dispatch.requestedAt.toISOString(),
            callId: dispatch.callId,
          },
        })),
      };

      logger.info('Map dispatches retrieved', {
        count: dispatches.length,
        lastHours,
      });

      return {
        dispatches,
        geoJson,
      };
    } catch (error) {
      logger.error('Failed to get map dispatches', error as Error, { filters });
      throw new Error('Failed to get map dispatches');
    }
  }

  async getDispatchById(id: string) {
    logger.info('Getting dispatch by ID', { id });

    try {
      const dispatch = await prisma.dispatch.findUnique({
        where: { id },
        include: {
          call: {
            include: {
              patient: true,
              triageReport: true,
            },
          },
        },
      });

      if (!dispatch) {
        throw new Error('Dispatch not found');
      }

      return dispatch;
    } catch (error) {
      logger.error('Failed to get dispatch', error as Error, { id });
      throw error;
    }
  }
}

export const dispatchService = new DispatchService();
