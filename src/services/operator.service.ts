import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { OperatorStatus } from '@prisma/client';
import { Container } from '@/infrastructure/di/Container';
import { OperatorStatusChangedEvent } from '@/domain/operator/events/OperatorStatusChanged.event';
import { CallClaimedEvent } from '@/domain/operator/events/CallClaimed.event';

export interface CreateOperatorInput {
  name: string;
  email: string;
  role?: string;
}

export interface UpdateOperatorStatusInput {
  operatorId: string;
  status: OperatorStatus;
}

export interface ClaimCallInput {
  operatorId: string;
  queueEntryId: string;
}

export class OperatorService {
  async createOperator(input: CreateOperatorInput) {
    const { name, email, role = 'operator' } = input;

    logger.info('Creating operator', { name, email });

    try {
      const operator = await prisma.operator.create({
        data: {
          name,
          email,
          role,
          status: OperatorStatus.OFFLINE,
          totalCallsHandled: 0,
          averageHandleTime: 0,
        },
      });

      logger.info('Operator created', { operatorId: operator.id, name });

      return operator;
    } catch (error) {
      logger.error('Failed to create operator', error as Error, { name, email });
      throw new Error('Failed to create operator');
    }
  }

  async listOperators() {
    logger.info('Listing all operators');

    try {
      const operators = await prisma.operator.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      logger.info('Operators retrieved', { count: operators.length });

      return operators;
    } catch (error) {
      logger.error('Failed to list operators', error as Error);
      throw new Error('Failed to list operators');
    }
  }

  async getAvailableOperators() {
    logger.info('Getting available operators');

    try {
      const operators = await prisma.operator.findMany({
        where: {
          status: OperatorStatus.AVAILABLE,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      logger.info('Available operators retrieved', { count: operators.length });

      return operators;
    } catch (error) {
      logger.error('Failed to get available operators', error as Error);
      throw new Error('Failed to get available operators');
    }
  }

  async updateOperatorStatus(input: UpdateOperatorStatusInput) {
    const { operatorId, status } = input;

    logger.info('Updating operator status', { operatorId, status });

    try {
      // Get current operator to track previous status
      const currentOperator = await prisma.operator.findUnique({
        where: { id: operatorId },
      });

      if (!currentOperator) {
        throw new Error(`Operator not found: ${operatorId}`);
      }

      const previousStatus = currentOperator.status;

      const operator = await prisma.operator.update({
        where: { id: operatorId },
        data: { status },
      });

      logger.info('Operator status updated', {
        operatorId,
        previousStatus,
        newStatus: status,
      });

      // Publish OperatorStatusChangedEvent for real-time dashboard
      const container = Container.getInstance();
      const eventBus = container.getEventBus();
      await eventBus.publish(
        new OperatorStatusChangedEvent(
          operatorId,
          operator.email,
          previousStatus as import('@/domain/operator/entities/Operator.entity').OperatorStatus,
          status as import('@/domain/operator/entities/Operator.entity').OperatorStatus
        )
      );

      return operator;
    } catch (error) {
      logger.error('Failed to update operator status', error as Error, {
        operatorId,
        status,
      });
      throw error;
    }
  }

  async claimCall(input: ClaimCallInput) {
    const { operatorId, queueEntryId } = input;

    logger.info('Claiming call', { operatorId, queueEntryId });

    try {
      // Vérifier que l'opérateur existe et est disponible
      const operator = await prisma.operator.findUnique({
        where: { id: operatorId },
      });

      if (!operator) {
        throw new Error(`Operator not found: ${operatorId}`);
      }

      if (operator.status !== OperatorStatus.AVAILABLE) {
        throw new Error(`Operator is not available: ${operator.status}`);
      }

      // Vérifier que l'entrée de queue existe et est en attente
      const queueEntry = await prisma.queueEntry.findUnique({
        where: { id: queueEntryId },
        include: { call: true },
      });

      if (!queueEntry) {
        throw new Error(`Queue entry not found: ${queueEntryId}`);
      }

      if (queueEntry.status !== 'WAITING') {
        throw new Error(`Queue entry is not waiting: ${queueEntry.status}`);
      }

      // Mettre à jour la queue entry
      const updatedEntry = await prisma.queueEntry.update({
        where: { id: queueEntryId },
        data: {
          status: 'CLAIMED',
          claimedBy: operatorId,
          claimedAt: new Date(),
        },
      });

      // Mettre à jour le statut de l'opérateur
      await prisma.operator.update({
        where: { id: operatorId },
        data: { status: OperatorStatus.BUSY },
      });

      logger.info('Call claimed successfully', {
        operatorId,
        queueEntryId,
        callId: queueEntry.callId,
      });

      // Publish CallClaimedEvent for real-time dashboard
      const container = Container.getInstance();
      const eventBus = container.getEventBus();

      // Calculate queue wait time in seconds
      const queueWaitTime = Math.floor(
        (new Date().getTime() - queueEntry.waitingSince.getTime()) / 1000
      );

      await eventBus.publish(
        new CallClaimedEvent(queueEntry.callId, operatorId, operator.email, queueWaitTime)
      );

      return updatedEntry;
    } catch (error) {
      logger.error('Failed to claim call', error as Error, {
        operatorId,
        queueEntryId,
      });
      throw error;
    }
  }

  async getOperatorById(id: string) {
    logger.info('Getting operator by ID', { id });

    try {
      const operator = await prisma.operator.findUnique({
        where: { id },
      });

      if (!operator) {
        throw new Error('Operator not found');
      }

      return operator;
    } catch (error) {
      logger.error('Failed to get operator', error as Error, { id });
      throw error;
    }
  }
}

export const operatorService = new OperatorService();
