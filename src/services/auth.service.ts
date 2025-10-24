import { IUserRepository } from '../domain/user/repositories/IUserRepository.js';
import { Password } from '../domain/user/value-objects/Password.vo.js';
import { Role } from '../domain/user/entities/User.entity.js';
import { RedisTokenStore } from '../infrastructure/auth/RedisTokenStore.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  AccessTokenPayload,
} from '../infrastructure/auth/jwt.util.js';
import { IEventBus } from '../domain/shared/IEventBus.js';
import { UserCreated } from '../domain/user/events/UserCreated.event.js';
import { UserLoggedIn } from '../domain/user/events/UserLoggedIn.event.js';
import { UserLoggedOut } from '../domain/user/events/UserLoggedOut.event.js';
import { logger } from '../utils/logger.js';

export interface RegisterUserData {
  employeeId: string;
  fullName: string;
  password: string;
  role: Role;
  createdByUserId: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RefreshResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * Authentication Service
 *
 * Handles user registration, login, token refresh, and logout
 */
export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenStore: RedisTokenStore,
    private readonly eventBus: IEventBus,
    private readonly accessTokenSecret: string,
    private readonly refreshTokenSecret: string,
    private readonly accessTokenExpiry: string = '15m',
    private readonly refreshTokenExpiry: string = '7d'
  ) {}

  /**
   * Register a new user (Admin only)
   */
  async register(data: RegisterUserData): Promise<{
    id: string;
    employeeId: string;
    fullName: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
  }> {
    // Check if employee ID already exists
    const exists = await this.userRepository.existsByEmployeeId(data.employeeId);
    if (exists) {
      throw new Error('Employee ID already exists');
    }

    // Hash password
    const passwordVO = await Password.create(data.password);

    // Create user
    const user = await this.userRepository.create({
      employeeId: data.employeeId,
      fullName: data.fullName,
      password: passwordVO.getValue(),
      role: data.role,
      createdBy: data.createdByUserId,
    });

    // Publish event
    await this.eventBus.publish(
      new UserCreated({
        userId: user.id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        role: user.role,
        createdBy: data.createdByUserId,
      })
    );

    logger.info('User registered', {
      userId: user.id,
      employeeId: user.employeeId,
      role: user.role,
    });

    return {
      id: user.id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Login user
   */
  async login(employeeId: string, password: string, userAgent?: string): Promise<LoginResult> {
    // Find user by employee ID
    const user = await this.userRepository.findByEmployeeId(employeeId);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Validate password
    const isValid = await user.validatePassword(password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.updateLastLogin();
    await this.userRepository.update(user);

    // Generate tokens
    const accessTokenPayload: AccessTokenPayload = {
      userId: user.id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      role: user.role,
      operatorId: user.operatorId,
    };

    const accessToken = generateAccessToken(
      accessTokenPayload,
      this.accessTokenSecret,
      this.accessTokenExpiry
    );

    const refreshTokenData = generateRefreshToken(
      user.id,
      this.refreshTokenSecret,
      this.refreshTokenExpiry
    );

    // Store refresh token in Redis
    await this.tokenStore.storeRefreshToken(
      user.id,
      refreshTokenData.tokenId,
      user.employeeId,
      refreshTokenData.expiresIn,
      userAgent
    );

    // Publish event
    await this.eventBus.publish(
      new UserLoggedIn({
        userId: user.id,
        employeeId: user.employeeId,
        role: user.role,
        timestamp: new Date(),
      })
    );

    logger.info('User logged in', {
      userId: user.id,
      employeeId: user.employeeId,
    });

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken, this.refreshTokenSecret);

    // Check if token exists in Redis
    const isValid = await this.tokenStore.verifyRefreshToken(decoded.userId, decoded.tokenId);
    if (!isValid) {
      throw new Error('Invalid or revoked refresh token');
    }

    // Get user
    const user = await this.userRepository.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate new access token
    const accessTokenPayload: AccessTokenPayload = {
      userId: user.id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      role: user.role,
      operatorId: user.operatorId,
    };

    const accessToken = generateAccessToken(
      accessTokenPayload,
      this.accessTokenSecret,
      this.accessTokenExpiry
    );

    logger.debug('Access token refreshed', { userId: user.id });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      // Verify and decode refresh token to get tokenId
      const decoded = verifyRefreshToken(refreshToken, this.refreshTokenSecret);

      // Revoke the specific token
      await this.tokenStore.revokeRefreshToken(decoded.userId, decoded.tokenId);

      // Get user for event
      const user = await this.userRepository.findById(userId);

      // Publish event
      if (user) {
        await this.eventBus.publish(
          new UserLoggedOut({
            userId: user.id,
            employeeId: user.employeeId,
            allDevices: false,
            timestamp: new Date(),
          })
        );
      }

      logger.info('User logged out', { userId });
    } catch (error) {
      logger.error('Logout failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      // Revoke all user tokens
      await this.tokenStore.revokeAllUserTokens(userId);

      // Get user for event
      const user = await this.userRepository.findById(userId);

      // Publish event
      if (user) {
        await this.eventBus.publish(
          new UserLoggedOut({
            userId: user.id,
            employeeId: user.employeeId,
            allDevices: true,
            timestamp: new Date(),
          })
        );
      }

      logger.info('User logged out from all devices', { userId });
    } catch (error) {
      logger.error('Logout all devices failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Validate user exists and is active
   */
  async validateUser(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    return user !== null && user.isActive;
  }
}
