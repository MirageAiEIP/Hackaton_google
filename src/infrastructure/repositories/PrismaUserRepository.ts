import { PrismaClient, Prisma } from '@prisma/client';
import {
  IUserRepository,
  UserFilters,
  PaginationOptions,
  PaginatedResult,
} from '@/domain/user/repositories/IUserRepository.js';
import { User, CreateUserProps, Role } from '@/domain/user/entities/User.entity.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? this.toDomain(user) : null;
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { employeeId },
    });

    return user ? this.toDomain(user) : null;
  }

  async findAll(
    filters?: UserFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { employeeId: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.toDomain(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(props: CreateUserProps): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        employeeId: props.employeeId,
        fullName: props.fullName,
        password: props.password,
        role: props.role,
        createdBy: props.createdBy || null,
        operatorId: props.operatorId || null,
      },
    });

    return this.toDomain(user);
  }

  async update(user: User): Promise<User> {
    const userProps = user.toObject();

    const updated = await this.prisma.user.update({
      where: { id: userProps.id },
      data: {
        fullName: userProps.fullName,
        password: userProps.password,
        role: userProps.role,
        isActive: userProps.isActive,
        operatorId: userProps.operatorId,
        lastLoginAt: userProps.lastLoginAt,
        updatedAt: userProps.updatedAt,
      },
    });

    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async existsByEmployeeId(employeeId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { employeeId },
    });
    return count > 0;
  }

  /**
   * Convert Prisma model to Domain entity
   */
  private toDomain(prismaUser: Prisma.UserGetPayload<object>): User {
    return User.fromObject({
      id: prismaUser.id,
      employeeId: prismaUser.employeeId,
      fullName: prismaUser.fullName,
      password: prismaUser.password,
      role: prismaUser.role as Role,
      isActive: prismaUser.isActive,
      operatorId: prismaUser.operatorId,
      createdBy: prismaUser.createdBy,
      lastLoginAt: prismaUser.lastLoginAt,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }
}
