import { PrismaClient, CallStatus, Call as PrismaCall } from '@prisma/client';
import { ICallRepository } from '@/domain/triage/repositories/ICallRepository';
import { Call } from '@/domain/triage/entities/Call.entity';
import { logger } from '@/utils/logger';

export class PrismaCallRepository implements ICallRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(call: Call): Promise<void> {
    try {
      await this.prisma.call.upsert({
        where: { id: call.id },
        create: {
          id: call.id,
          patientId: call.patientId,
          status: call.status as CallStatus,
          startedAt: call.startedAt,
          endedAt: call.endedAt,
          duration: call.duration,
          transcript: call.transcript,
          audioRecordingUrl: call.audioRecordingUrl,
        },
        update: {
          status: call.status as CallStatus,
          endedAt: call.endedAt,
          duration: call.duration,
          transcript: call.transcript,
          audioRecordingUrl: call.audioRecordingUrl,
        },
      });

      logger.debug('Call saved', { callId: call.id });
    } catch (error) {
      logger.error('Failed to save call', error as Error, { callId: call.id });
      throw error;
    }
  }

  async findById(id: string): Promise<Call | null> {
    try {
      const call = await this.prisma.call.findUnique({
        where: { id },
        include: {
          patient: true,
          triageReport: true,
          symptoms: true,
          redFlags: true,
        },
      });

      if (!call) {
        logger.debug('Call not found', { callId: id });
        return null;
      }

      logger.debug('Call found', { callId: id });
      return this.toDomain(call);
    } catch (error) {
      logger.error('Failed to find call by ID', error as Error, { callId: id });
      throw error;
    }
  }

  async findByPhoneHash(phoneHash: string): Promise<Call[]> {
    try {
      const calls = await this.prisma.call.findMany({
        where: {
          patient: {
            phoneHash,
          },
        },
        include: {
          triageReport: true,
          symptoms: true,
          redFlags: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      logger.debug('Calls found by phone hash', {
        phoneHash: phoneHash.substring(0, 8) + '...',
        count: calls.length,
      });

      return calls.map((call) => this.toDomain(call));
    } catch (error) {
      logger.error('Failed to find calls by phone hash', error as Error, {
        phoneHash: phoneHash.substring(0, 8) + '...',
      });
      throw error;
    }
  }

  async findActiveCalls(): Promise<Call[]> {
    try {
      const calls = await this.prisma.call.findMany({
        where: {
          status: CallStatus.IN_PROGRESS,
        },
        include: {
          patient: true,
          triageReport: true,
        },
        orderBy: {
          startedAt: 'asc',
        },
      });

      logger.debug('Active calls found', { count: calls.length });

      return calls.map((call) => this.toDomain(call));
    } catch (error) {
      logger.error('Failed to find active calls', error as Error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.call.delete({
        where: { id },
      });

      logger.debug('Call deleted', { callId: id });
    } catch (error) {
      logger.error('Failed to delete call', error as Error, { callId: id });
      throw error;
    }
  }

  private toDomain(prismaCall: PrismaCall): Call {
    return new Call(
      prismaCall.id,
      prismaCall.createdAt,
      prismaCall.updatedAt,
      prismaCall.startedAt,
      prismaCall.status,
      prismaCall.patientId,
      prismaCall.endedAt,
      prismaCall.duration,
      prismaCall.transcript,
      prismaCall.audioRecordingUrl,
      prismaCall.agentVersion,
      prismaCall.modelUsed,
      prismaCall.processingTime,
      prismaCall.qualityScore
    );
  }
}
