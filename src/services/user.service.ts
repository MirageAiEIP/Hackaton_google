import {
  IUserRepository,
  UserFilters,
  PaginationOptions,
  PaginatedResult,
} from '../domain/user/repositories/IUserRepository.js';
import { User, Role } from '../domain/user/entities/User.entity.js';
import { logger } from '../utils/logger.js';

export interface UpdateUserData {
  fullName?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * User Service
 *
 * Handles user management operations
 */
export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Get user by employee ID
   */
  async getUserByEmployeeId(employeeId: string): Promise<User | null> {
    return this.userRepository.findByEmployeeId(employeeId);
  }

  /**
   * List users with optional filters and pagination
   */
  async listUsers(
    filters?: UserFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<User>> {
    return this.userRepository.findAll(filters, pagination);
  }

  /**
   * Update user information
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    // Get existing user
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Apply updates
    if (data.fullName !== undefined) {
      user.updateFullName(data.fullName);
    }

    if (data.role !== undefined) {
      user.updateRole(data.role);
    }

    if (data.isActive !== undefined) {
      if (data.isActive) {
        user.activate();
      } else {
        user.deactivate();
      }
    }

    // Save changes
    const updated = await this.userRepository.update(user);

    logger.info('User updated', {
      userId: id,
      updates: data,
    });

    return updated;
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.deactivate();
    await this.userRepository.update(user);

    logger.info('User deactivated', { userId: id });
  }

  /**
   * Change user password
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    // Get user
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await user.validatePassword(oldPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    await user.updatePassword(newPassword);
    await this.userRepository.update(user);

    logger.info('User password changed', { userId: id });
  }

  /**
   * Reset user password (admin only)
   */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    // Get user
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update password
    await user.updatePassword(newPassword);
    await this.userRepository.update(user);

    logger.info('User password reset by admin', { userId: id });
  }
}
