import { PrismaClient } from '@prisma/client';
import { IHandoffRepository, Handoff } from '@/domain/triage/repositories/IHandoffRepository';

/**
 * Prisma implementation of Handoff Repository
 */
export class PrismaHandoffRepository implements IHandoffRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Handoff | null> {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id },
    });

    return handoff ? this.toDomain(handoff) : null;
  }

  async findByCallId(callId: string): Promise<Handoff | null> {
    const handoff = await this.prisma.handoff.findFirst({
      where: { callId },
      orderBy: { requestedAt: 'desc' },
    });

    return handoff ? this.toDomain(handoff) : null;
  }

  async findPending(): Promise<Handoff[]> {
    const handoffs = await this.prisma.handoff.findMany({
      where: { status: 'REQUESTED' },
      orderBy: { requestedAt: 'asc' },
    });

    return handoffs.map((h) => this.toDomain(h));
  }

  async findByOperator(operatorId: string): Promise<Handoff[]> {
    const handoffs = await this.prisma.handoff.findMany({
      where: { toOperatorId: operatorId },
      orderBy: { requestedAt: 'desc' },
    });

    return handoffs.map((h) => this.toDomain(h));
  }

  async save(handoff: Handoff): Promise<void> {
    await this.prisma.handoff.upsert({
      where: { id: handoff.id },
      create: {
        id: handoff.id,
        callId: handoff.callId,
        fromAgent: handoff.fromAgent,
        toOperatorId: handoff.toOperatorId,
        reason: handoff.reason,
        conversationId: handoff.conversationId,
        transcript: handoff.transcript,
        aiContext: handoff.aiContext,
        patientSummary: handoff.patientSummary,
        status: handoff.status as unknown,
        requestedAt: handoff.requestedAt,
        acceptedAt: handoff.acceptedAt,
        completedAt: handoff.completedAt,
        handoffDuration: handoff.handoffDuration,
      },
      update: {
        status: handoff.status as unknown,
        acceptedAt: handoff.acceptedAt,
        completedAt: handoff.completedAt,
        handoffDuration: handoff.handoffDuration,
        updatedAt: new Date(),
      },
    });
  }

  async accept(handoffId: string, operatorId: string): Promise<void> {
    await this.prisma.handoff.update({
      where: { id: handoffId },
      data: {
        status: 'ACCEPTED',
        toOperatorId: operatorId,
        acceptedAt: new Date(),
      },
    });
  }

  async complete(handoffId: string): Promise<void> {
    const handoff = await this.prisma.handoff.findUnique({
      where: { id: handoffId },
    });

    if (!handoff) {
      throw new Error(`Handoff not found: ${handoffId}`);
    }

    const duration = handoff.acceptedAt
      ? Math.floor((Date.now() - handoff.acceptedAt.getTime()) / 1000)
      : undefined;

    await this.prisma.handoff.update({
      where: { id: handoffId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        handoffDuration: duration,
      },
    });
  }

  async reject(handoffId: string, reason: string): Promise<void> {
    await this.prisma.handoff.update({
      where: { id: handoffId },
      data: {
        status: 'REJECTED',
        aiContext: {
          rejectionReason: reason,
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.handoff.delete({
      where: { id },
    });
  }

  /**
   * Convert Prisma model to domain object
   */
  private toDomain(prismaHandoff: unknown): Handoff {
    return {
      id: prismaHandoff.id,
      callId: prismaHandoff.callId,
      fromAgent: prismaHandoff.fromAgent,
      toOperatorId: prismaHandoff.toOperatorId,
      reason: prismaHandoff.reason,
      conversationId: prismaHandoff.conversationId ?? undefined,
      transcript: prismaHandoff.transcript,
      aiContext: prismaHandoff.aiContext,
      patientSummary: prismaHandoff.patientSummary,
      status: prismaHandoff.status,
      requestedAt: prismaHandoff.requestedAt,
      acceptedAt: prismaHandoff.acceptedAt ?? undefined,
      completedAt: prismaHandoff.completedAt ?? undefined,
      handoffDuration: prismaHandoff.handoffDuration ?? undefined,
      createdAt: prismaHandoff.createdAt,
      updatedAt: prismaHandoff.updatedAt,
    };
  }
}
