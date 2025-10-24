import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { PriorityLevel, QueueStatus, Prisma } from '@prisma/client';
import { Container } from '@/infrastructure/di/Container';
import { QueueEntryAddedEvent } from '@/domain/triage/events/QueueEntryAdded.event';
import { QueueEntryStatusChangedEvent } from '@/domain/triage/events/QueueEntryStatusChanged.event';

export interface CreateQueueEntryInput {
  callId: string;
  priority: PriorityLevel;
  chiefComplaint: string;
  patientAge?: number;
  patientGender?: string;
  location?: string;
  aiSummary: string;
  aiRecommendation: string;
  keySymptoms?: string[];
  redFlags?: string[];
  conversationId?: string;
}

export interface ClaimQueueEntryInput {
  queueEntryId: string;
  operatorId: string;
}

export class QueueService {
  async addToQueue(input: CreateQueueEntryInput) {
    const {
      callId,
      priority,
      chiefComplaint,
      patientAge,
      patientGender,
      location,
      aiSummary,
      aiRecommendation,
      keySymptoms,
      redFlags,
      conversationId,
    } = input;

    // Validation: P3 should receive direct advice from Agent 1, not be queued
    // P0/P1/P2 can be queued if no operator is available
    if (priority === 'P3') {
      throw new Error('P3 should receive direct advice from Agent 1, not be queued');
    }

    logger.info('Adding call to queue', {
      callId,
      priority,
    });

    try {
      const queueEntry = await prisma.queueEntry.create({
        data: {
          callId,
          priority,
          chiefComplaint,
          patientAge,
          patientGender,
          location,
          aiSummary,
          aiRecommendation,
          keySymptoms: keySymptoms || [],
          redFlags: redFlags || [],
          conversationId,
          status: 'WAITING',
        },
        include: {
          call: {
            include: {
              patient: true,
            },
          },
        },
      });

      logger.info('Call added to queue', {
        queueEntryId: queueEntry.id,
        callId,
        priority,
      });

      // Publish QueueEntryAddedEvent for real-time dashboard
      const container = Container.getInstance();
      const eventBus = container.getEventBus();
      await eventBus.publish(new QueueEntryAddedEvent(queueEntry.id, callId, priority, 0));

      return queueEntry;
    } catch (error) {
      logger.error('Failed to add call to queue', error as Error, {
        callId,
        priority,
      });
      throw new Error('Failed to add call to queue');
    }
  }

  async listQueue(filters?: { status?: QueueStatus; priority?: PriorityLevel }) {
    logger.info('Listing queue', { filters });

    try {
      const where: Prisma.QueueEntryWhereInput = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.priority) {
        where.priority = filters.priority;
      }

      const queueEntries = await prisma.queueEntry.findMany({
        where,
        include: {
          call: {
            include: {
              patient: true,
            },
          },
        },
        orderBy: [
          { priority: 'asc' }, // P2 avant P3 avant P4
          { waitingSince: 'asc' }, // Plus vieux en premier
        ],
      });

      logger.info('Queue entries retrieved', { count: queueEntries.length });

      return queueEntries;
    } catch (error) {
      logger.error('Failed to list queue', error as Error, { filters });
      throw new Error('Failed to list queue');
    }
  }

  async claimQueueEntry(input: ClaimQueueEntryInput) {
    const { queueEntryId, operatorId } = input;

    logger.info('Claiming queue entry', {
      queueEntryId,
      operatorId,
    });

    try {
      const queueEntry = await prisma.queueEntry.findUnique({
        where: { id: queueEntryId },
      });

      if (!queueEntry) {
        throw new Error('Queue entry not found');
      }

      if (queueEntry.status !== 'WAITING') {
        throw new Error(`Queue entry already ${queueEntry.status.toLowerCase()}`);
      }

      const updatedEntry = await prisma.queueEntry.update({
        where: { id: queueEntryId },
        data: {
          status: 'CLAIMED',
          claimedBy: operatorId,
          claimedAt: new Date(),
        },
        include: {
          call: {
            include: {
              patient: true,
            },
          },
        },
      });

      logger.info('Queue entry claimed', {
        queueEntryId,
        operatorId,
        callId: updatedEntry.callId,
      });

      return updatedEntry;
    } catch (error) {
      logger.error('Failed to claim queue entry', error as Error, {
        queueEntryId,
        operatorId,
      });
      throw error;
    }
  }

  async updateQueueStatus(queueEntryId: string, status: QueueStatus) {
    logger.info('Updating queue entry status', {
      queueEntryId,
      status,
    });

    try {
      // Get current entry to track previous status
      const currentEntry = await prisma.queueEntry.findUnique({
        where: { id: queueEntryId },
      });

      if (!currentEntry) {
        throw new Error(`Queue entry not found: ${queueEntryId}`);
      }

      const previousStatus = currentEntry.status;

      const updatedEntry = await prisma.queueEntry.update({
        where: { id: queueEntryId },
        data: { status },
      });

      logger.info('Queue entry status updated', {
        queueEntryId,
        status,
      });

      // Publish QueueEntryStatusChangedEvent for real-time dashboard
      const container = Container.getInstance();
      const eventBus = container.getEventBus();
      await eventBus.publish(
        new QueueEntryStatusChangedEvent(
          queueEntryId,
          currentEntry.callId,
          previousStatus,
          status,
          currentEntry.claimedBy
        )
      );

      return updatedEntry;
    } catch (error) {
      logger.error('Failed to update queue entry status', error as Error, {
        queueEntryId,
        status,
      });
      throw new Error('Failed to update queue entry status');
    }
  }

  async getQueueEntryById(id: string) {
    logger.info('Getting queue entry by ID', { id });

    try {
      const queueEntry = await prisma.queueEntry.findUnique({
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

      if (!queueEntry) {
        throw new Error('Queue entry not found');
      }

      return queueEntry;
    } catch (error) {
      logger.error('Failed to get queue entry', error as Error, { id });
      throw error;
    }
  }

  async getQueueStats() {
    logger.info('Getting queue statistics');

    try {
      const [total, waiting, claimed, inProgress, completed, abandoned] = await Promise.all([
        prisma.queueEntry.count(),
        prisma.queueEntry.count({ where: { status: 'WAITING' } }),
        prisma.queueEntry.count({ where: { status: 'CLAIMED' } }),
        prisma.queueEntry.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.queueEntry.count({ where: { status: 'COMPLETED' } }),
        prisma.queueEntry.count({ where: { status: 'ABANDONED' } }),
      ]);

      const waitingEntries = await prisma.queueEntry.findMany({
        where: { status: 'WAITING' },
        select: { waitingSince: true },
      });

      const avgWaitTime =
        waitingEntries.length > 0
          ? waitingEntries.reduce((sum, entry) => {
              return sum + (Date.now() - entry.waitingSince.getTime());
            }, 0) /
            waitingEntries.length /
            1000
          : 0;

      const stats = {
        total,
        byStatus: {
          waiting,
          claimed,
          inProgress,
          completed,
          abandoned,
        },
        avgWaitTimeSeconds: Math.floor(avgWaitTime),
      };

      logger.info('Queue statistics retrieved', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get queue statistics', error as Error);
      throw new Error('Failed to get queue statistics');
    }
  }
}

export const queueService = new QueueService();
