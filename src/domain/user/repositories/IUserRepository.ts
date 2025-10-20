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

/**
 * User Repository Interface
 *
 * Defines the contract for user data persistence
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find user by employee ID
   */
  findByEmployeeId(employeeId: string): Promise<User | null>;

  /**
   * Find all users with optional filters and pagination
   */
  findAll(filters?: UserFilters, pagination?: PaginationOptions): Promise<PaginatedResult<User>>;

  /**
   * Create a new user
   */
  create(props: CreateUserProps): Promise<User>;

  /**
   * Update an existing user
   */
  update(user: User): Promise<User>;

  /**
   * Delete a user (soft delete by setting isActive = false)
   */
  delete(id: string): Promise<void>;

  /**
   * Check if employee ID exists
   */
  existsByEmployeeId(employeeId: string): Promise<boolean>;
}
