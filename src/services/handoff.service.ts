import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { HandoffStatus, Prisma, OperatorStatus } from '@prisma/client';
import { Container } from '@/infrastructure/di/Container';
import { HandoffRequestedEvent } from '@/domain/operator/events/HandoffRequested.event';
import { HandoffAcceptedEvent } from '@/domain/operator/events/HandoffAccepted.event';

export interface CreateHandoffInput {
  callId: string;
  toOperatorId: string;
  reason: string;
  conversationId?: string;
  transcript: string;
  aiContext: Prisma.InputJsonValue;
  patientSummary: string;
}

export interface TakeControlInput {
  callId: string;
  operatorId: string;
  reason?: string;
}

export interface RequestHandoffFromAgentInput {
  callId: string;
  conversationId: string;
  reason: string;
  transcript: string;
  patientSummary: string;
  aiContext?: Record<string, unknown>;
}

export class HandoffService {
  /**
   * Request handoff from AI agent
   * Auto-assigns to available operator if one exists, otherwise creates pending handoff
   */
  async requestHandoffFromAgent(input: RequestHandoffFromAgentInput) {
    const { callId, conversationId, reason, transcript, patientSummary, aiContext } = input;

    logger.info('AI requesting handoff', {
      callId,
      conversationId,
      reason,
    });

    try {
      // Try to find an available operator
      const availableOperator = await prisma.operator.findFirst({
        where: { status: OperatorStatus.AVAILABLE },
        orderBy: { totalCallsHandled: 'asc' }, // Load balancing: assign to operator with least calls
      });

      const container = Container.getInstance();
      const eventBus = container.getEventBus();

      if (availableOperator) {
        // Auto-assign to available operator
        logger.info('Available operator found, auto-assigning', {
          operatorId: availableOperator.id,
          operatorName: availableOperator.name,
        });

        const handoff = await prisma.handoff.create({
          data: {
            callId,
            toOperatorId: availableOperator.id,
            fromAgent: true,
            reason,
            conversationId,
            transcript,
            aiContext: aiContext as Prisma.InputJsonValue,
            patientSummary,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        // Update operator status to BUSY
        await prisma.operator.update({
          where: { id: availableOperator.id },
          data: { status: OperatorStatus.BUSY },
        });

        // Publish HandoffAcceptedEvent for real-time dashboard
        await eventBus.publish(
          new HandoffAcceptedEvent(
            handoff.id,
            '', // queueEntryId not applicable for direct assignment
            availableOperator.id,
            availableOperator.name,
            callId
          )
        );

        logger.info('Handoff auto-assigned successfully', {
          handoffId: handoff.id,
          operatorId: availableOperator.id,
          operatorName: availableOperator.name,
        });

        return {
          handoffId: handoff.id,
          status: 'ACCEPTED' as const,
          assignedOperatorId: availableOperator.id,
          message: `Handoff assigned to operator ${availableOperator.name}`,
        };
      } else {
        // No operators available - create pending handoff
        logger.info('No operators available, creating pending handoff');

        const handoff = await prisma.handoff.create({
          data: {
            callId,
            fromAgent: true,
            reason,
            conversationId,
            transcript,
            aiContext: aiContext as Prisma.InputJsonValue,
            patientSummary,
            status: 'REQUESTED',
          },
        });

        // Publish HandoffRequestedEvent for real-time dashboard
        await eventBus.publish(
          new HandoffRequestedEvent(
            callId,
            conversationId,
            reason,
            true, // fromAgent
            'UNKNOWN' // priority - could be extracted from aiContext if available
          )
        );

        logger.info('Handoff request queued (no operators available)', {
          handoffId: handoff.id,
        });

        return {
          handoffId: handoff.id,
          status: 'REQUESTED' as const,
          message: 'No operators available. Handoff request queued.',
        };
      }
    } catch (error) {
      logger.error('Failed to request handoff from agent', error as Error, {
        callId,
        conversationId,
      });
      throw error;
    }
  }

  async requestHandoff(input: CreateHandoffInput) {
    const { callId, toOperatorId, reason, conversationId, transcript, aiContext, patientSummary } =
      input;

    logger.info('Requesting handoff', {
      callId,
      toOperatorId,
    });

    try {
      const handoff = await prisma.handoff.create({
        data: {
          callId,
          toOperatorId,
          reason,
          conversationId,
          transcript,
          aiContext,
          patientSummary,
          status: 'REQUESTED',
        },
        include: {
          call: true,
        },
      });

      logger.info('Handoff requested', {
        handoffId: handoff.id,
        callId,
        toOperatorId,
      });

      return handoff;
    } catch (error) {
      logger.error('Failed to request handoff', error as Error, {
        callId,
        toOperatorId,
      });
      throw new Error('Failed to request handoff');
    }
  }

  async acceptHandoff(handoffId: string) {
    logger.info('Accepting handoff', { handoffId });

    try {
      const handoff = await prisma.handoff.findUnique({
        where: { id: handoffId },
      });

      if (!handoff) {
        throw new Error('Handoff not found');
      }

      if (handoff.status !== 'REQUESTED') {
        throw new Error(`Handoff already ${handoff.status.toLowerCase()}`);
      }

      const updatedHandoff = await prisma.handoff.update({
        where: { id: handoffId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        include: {
          call: true,
        },
      });

      logger.info('Handoff accepted', {
        handoffId,
        callId: handoff.callId,
        toOperatorId: handoff.toOperatorId,
      });

      return updatedHandoff;
    } catch (error) {
      logger.error('Failed to accept handoff', error as Error, { handoffId });
      throw error;
    }
  }

  async takeControl(input: TakeControlInput) {
    const { callId, operatorId, reason } = input;

    logger.info('Taking control of call', {
      callId,
      operatorId,
    });

    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          elevenLabsConversation: true,
        },
      });

      if (!call) {
        throw new Error('Call not found');
      }

      if (call.status === 'COMPLETED' || call.status === 'CANCELLED') {
        throw new Error(`Call already ${call.status.toLowerCase()}`);
      }

      const handoff = await prisma.handoff.create({
        data: {
          callId,
          toOperatorId: operatorId,
          reason: reason || 'Prise de contrôle manuelle depuis dashboard',
          transcript: call.transcript || '',
          aiContext: {
            conversationId: call.elevenLabsConversation?.conversationId,
            takenAt: new Date().toISOString(),
            manualTakeover: true,
          } as Prisma.InputJsonValue,
          patientSummary: `Opérateur ${operatorId} a pris le contrôle`,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'ESCALATED',
        },
      });

      logger.info('Control taken successfully', {
        callId,
        operatorId,
        handoffId: handoff.id,
      });

      return {
        handoff,
        conversationContext: {
          conversationId: call.elevenLabsConversation?.conversationId,
          transcript: call.transcript,
          status: call.status,
        },
      };
    } catch (error) {
      logger.error('Failed to take control', error as Error, {
        callId,
        operatorId,
      });
      throw error;
    }
  }

  async updateHandoffStatus(handoffId: string, status: HandoffStatus) {
    logger.info('Updating handoff status', {
      handoffId,
      status,
    });

    try {
      const data: Prisma.HandoffUpdateInput = { status };

      if (status === 'COMPLETED') {
        data.completedAt = new Date();

        const handoff = await prisma.handoff.findUnique({
          where: { id: handoffId },
        });

        if (handoff?.acceptedAt) {
          const duration = Math.floor((Date.now() - handoff.acceptedAt.getTime()) / 1000);
          data.handoffDuration = duration;
        }
      }

      const updatedHandoff = await prisma.handoff.update({
        where: { id: handoffId },
        data,
      });

      logger.info('Handoff status updated', {
        handoffId,
        status,
      });

      return updatedHandoff;
    } catch (error) {
      logger.error('Failed to update handoff status', error as Error, {
        handoffId,
        status,
      });
      throw new Error('Failed to update handoff status');
    }
  }

  async listHandoffs(filters?: { status?: HandoffStatus; operatorId?: string }) {
    logger.info('Listing handoffs', { filters });

    try {
      const where: Prisma.HandoffWhereInput = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.operatorId) {
        where.toOperatorId = filters.operatorId;
      }

      const handoffs = await prisma.handoff.findMany({
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

      logger.info('Handoffs retrieved', { count: handoffs.length });

      return handoffs;
    } catch (error) {
      logger.error('Failed to list handoffs', error as Error, { filters });
      throw new Error('Failed to list handoffs');
    }
  }

  async getHandoffById(id: string) {
    logger.info('Getting handoff by ID', { id });

    try {
      const handoff = await prisma.handoff.findUnique({
        where: { id },
        include: {
          call: {
            include: {
              patient: true,
              triageReport: true,
              elevenLabsConversation: true,
            },
          },
        },
      });

      if (!handoff) {
        throw new Error('Handoff not found');
      }

      return handoff;
    } catch (error) {
      logger.error('Failed to get handoff', error as Error, { id });
      throw error;
    }
  }

  async getHandoffStats() {
    logger.info('Getting handoff statistics');

    try {
      const [total, requested, accepted, inProgress, completed, rejected] = await Promise.all([
        prisma.handoff.count(),
        prisma.handoff.count({ where: { status: 'REQUESTED' } }),
        prisma.handoff.count({ where: { status: 'ACCEPTED' } }),
        prisma.handoff.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.handoff.count({ where: { status: 'COMPLETED' } }),
        prisma.handoff.count({ where: { status: 'REJECTED' } }),
      ]);

      const completedHandoffs = await prisma.handoff.findMany({
        where: {
          status: 'COMPLETED',
          handoffDuration: { not: null },
        },
        select: { handoffDuration: true },
      });

      const avgDuration =
        completedHandoffs.length > 0
          ? completedHandoffs.reduce((sum, h) => sum + (h.handoffDuration || 0), 0) /
            completedHandoffs.length
          : 0;

      const stats = {
        total,
        byStatus: {
          requested,
          accepted,
          inProgress,
          completed,
          rejected,
        },
        avgDurationSeconds: Math.floor(avgDuration),
      };

      logger.info('Handoff statistics retrieved', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get handoff statistics', error as Error);
      throw new Error('Failed to get handoff statistics');
    }
  }
}

export const handoffService = new HandoffService();
