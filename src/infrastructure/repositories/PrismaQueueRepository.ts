import {
  PrismaClient,
  QueueEntry as PrismaQueueEntry,
  PriorityLevel,
  QueueStatus,
} from '@prisma/client';
import { IQueueRepository, QueueEntry } from '@/domain/triage/repositories/IQueueRepository';

export class PrismaQueueRepository implements IQueueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<QueueEntry | null> {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
    });

    return entry ? this.toDomain(entry) : null;
  }

  async findByCallId(callId: string): Promise<QueueEntry | null> {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { callId },
    });

    return entry ? this.toDomain(entry) : null;
  }

  async findWaiting(): Promise<QueueEntry[]> {
    const entries = await this.prisma.queueEntry.findMany({
      where: { status: 'WAITING' },
      orderBy: [{ priority: 'asc' }, { waitingSince: 'asc' }],
    });

    return entries.map((entry) => this.toDomain(entry));
  }

  async findByOperator(operatorId: string): Promise<QueueEntry[]> {
    const entries = await this.prisma.queueEntry.findMany({
      where: {
        claimedBy: operatorId,
        status: { in: ['CLAIMED', 'IN_PROGRESS'] },
      },
      orderBy: { claimedAt: 'desc' },
    });

    return entries.map((entry) => this.toDomain(entry));
  }

  async save(entry: QueueEntry): Promise<void> {
    await this.prisma.queueEntry.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        callId: entry.callId,
        priority: entry.priority as PriorityLevel,
        chiefComplaint: entry.chiefComplaint,
        patientAge: entry.patientAge,
        patientGender: entry.patientGender,
        location: entry.location,
        aiSummary: entry.aiSummary,
        aiRecommendation: entry.aiRecommendation,
        keySymptoms: entry.keySymptoms,
        redFlags: entry.redFlags,
        status: entry.status as QueueStatus,
        waitingSince: entry.waitingSince,
        claimedBy: entry.claimedBy,
        claimedAt: entry.claimedAt,
        estimatedWaitTime: entry.estimatedWaitTime,
        conversationId: entry.conversationId,
      },
      update: {
        status: entry.status as QueueStatus,
        claimedBy: entry.claimedBy,
        claimedAt: entry.claimedAt,
        updatedAt: new Date(),
      },
    });
  }

  async claim(entryId: string, operatorId: string): Promise<void> {
    await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'CLAIMED',
        claimedBy: operatorId,
        claimedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.queueEntry.delete({
      where: { id },
    });
  }

  private toDomain(prismaEntry: PrismaQueueEntry): QueueEntry {
    return {
      id: prismaEntry.id,
      callId: prismaEntry.callId,
      priority: prismaEntry.priority,
      chiefComplaint: prismaEntry.chiefComplaint,
      patientAge: prismaEntry.patientAge ?? undefined,
      patientGender: prismaEntry.patientGender ?? undefined,
      location: prismaEntry.location ?? undefined,
      aiSummary: prismaEntry.aiSummary,
      aiRecommendation: prismaEntry.aiRecommendation,
      keySymptoms: prismaEntry.keySymptoms,
      redFlags: prismaEntry.redFlags,
      status: prismaEntry.status,
      waitingSince: prismaEntry.waitingSince,
      claimedBy: prismaEntry.claimedBy ?? undefined,
      claimedAt: prismaEntry.claimedAt ?? undefined,
      estimatedWaitTime: prismaEntry.estimatedWaitTime ?? undefined,
      conversationId: prismaEntry.conversationId ?? undefined,
      createdAt: prismaEntry.createdAt,
      updatedAt: prismaEntry.updatedAt,
    };
  }
}
