import {
  PrismaClient,
  Operator as PrismaOperator,
  Prisma,
  OperatorStatus as PrismaOperatorStatus,
} from '@prisma/client';
import { IOperatorRepository } from '@/domain/operator/repositories/IOperatorRepository';
import { Operator, OperatorStatus } from '@/domain/operator/entities/Operator.entity';

/**
 * Prisma implementation of Operator Repository
 * Adapter that maps between domain entities and Prisma models
 */
export class PrismaOperatorRepository implements IOperatorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Operator | null> {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
    });

    return operator ? this.toDomain(operator) : null;
  }

  async findByEmail(email: string): Promise<Operator | null> {
    const operator = await this.prisma.operator.findUnique({
      where: { email },
    });

    return operator ? this.toDomain(operator) : null;
  }

  async findByStatus(status: OperatorStatus): Promise<Operator[]> {
    const operators = await this.prisma.operator.findMany({
      where: { status },
      orderBy: { lastActiveAt: 'desc' },
    });

    return operators.map((op) => this.toDomain(op));
  }

  async findAvailable(): Promise<Operator[]> {
    const operators = await this.prisma.operator.findMany({
      where: {
        status: OperatorStatus.AVAILABLE,
        currentCallId: null,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return operators.map((op) => this.toDomain(op));
  }

  async findAll(): Promise<Operator[]> {
    const operators = await this.prisma.operator.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return operators.map((op) => this.toDomain(op));
  }

  async save(operator: Operator): Promise<void> {
    const data = this.toPrisma(operator);

    await this.prisma.operator.upsert({
      where: { id: operator.id },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.operator.delete({
      where: { id },
    });
  }

  async getStats(operatorId: string): Promise<{
    totalCallsHandled: number;
    averageHandleTime: number;
    currentStatus: OperatorStatus;
  } | null> {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: {
        totalCallsHandled: true,
        averageHandleTime: true,
        status: true,
      },
    });

    if (!operator) {
      return null;
    }

    return {
      totalCallsHandled: operator.totalCallsHandled,
      averageHandleTime: operator.averageHandleTime,
      currentStatus: operator.status as OperatorStatus,
    };
  }

  /**
   * Convert Prisma model to domain entity
   */
  private toDomain(prismaOperator: PrismaOperator): Operator {
    return new Operator({
      id: prismaOperator.id,
      email: prismaOperator.email,
      name: prismaOperator.name,
      role: prismaOperator.role,
      status: prismaOperator.status as OperatorStatus,
      lastActiveAt: prismaOperator.lastActiveAt || undefined,
      totalCallsHandled: prismaOperator.totalCallsHandled,
      averageHandleTime: prismaOperator.averageHandleTime,
      currentCallId: prismaOperator.currentCallId || undefined,
      createdAt: prismaOperator.createdAt,
      updatedAt: prismaOperator.updatedAt,
    });
  }

  /**
   * Convert domain entity to Prisma model
   */
  private toPrisma(operator: Operator): Prisma.OperatorCreateInput {
    const props = operator.toObject();
    return {
      id: props.id,
      email: props.email,
      name: props.name,
      role: props.role,
      status: props.status as PrismaOperatorStatus,
      lastActiveAt: props.lastActiveAt,
      totalCallsHandled: props.totalCallsHandled,
      averageHandleTime: props.averageHandleTime,
      currentCallId: props.currentCallId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}
