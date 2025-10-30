import { User, CreateUserProps } from '@/domain/user/entities/User.entity.js';

export interface UserFilters {
  role?: 'OPERATOR' | 'ADMIN';
  isActive?: boolean;
  search?: string; // Search by fullName or employeeId
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;

  findByEmployeeId(employeeId: string): Promise<User | null>;

  findAll(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedResult<User>>;

  create(props: CreateUserProps): Promise<User>;

  update(user: User): Promise<User>;

  delete(id: string): Promise<void>;

  existsByEmployeeId(employeeId: string): Promise<boolean>;
}
