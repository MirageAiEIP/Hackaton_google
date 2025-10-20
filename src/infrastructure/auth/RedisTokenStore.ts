import { Redis } from 'ioredis';
import { logger } from '@/utils/logger.js';

interface TokenMetadata {
  employeeId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
}

/**
 * Redis Token Store
 *
 * Manages refresh tokens in Redis with automatic expiration
 */
export class RedisTokenStore {
  private readonly KEY_PREFIX = 'refresh_token';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private readonly redis: Redis) {}

  /**
   * Store a refresh token in Redis
   *
   * @param userId - User ID
   * @param tokenId - Unique token ID
   * @param employeeId - Employee ID for metadata
   * @param expiresIn - TTL in seconds (default: 7 days)
   * @param userAgent - Optional user agent string
   */
  async storeRefreshToken(
    userId: string,
    tokenId: string,
    employeeId: string,
    expiresIn: number = this.DEFAULT_TTL,
    userAgent?: string
  ): Promise<void> {
    const key = this.buildKey(userId, tokenId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    const metadata: TokenMetadata = {
      employeeId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent,
    };

    try {
      await this.redis.setex(key, expiresIn, JSON.stringify(metadata));
      logger.info('Refresh token stored', { userId, tokenId });
    } catch (error) {
      logger.error('Failed to store refresh token', error as Error, { userId, tokenId });
      throw new Error('Failed to store refresh token');
    }
  }

  /**
   * Verify if a refresh token exists and is valid
   *
   * @param userId - User ID
   * @param tokenId - Token ID
   * @returns true if token exists and is valid
   */
  async verifyRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const key = this.buildKey(userId, tokenId);

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to verify refresh token', error as Error, { userId, tokenId });
      return false;
    }
  }

  /**
   * Get refresh token metadata
   *
   * @param userId - User ID
   * @param tokenId - Token ID
   * @returns Token metadata or null if not found
   */
  async getTokenMetadata(userId: string, tokenId: string): Promise<TokenMetadata | null> {
    const key = this.buildKey(userId, tokenId);

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get token metadata', error as Error, { userId, tokenId });
      return null;
    }
  }

  /**
   * Revoke a specific refresh token
   *
   * @param userId - User ID
   * @param tokenId - Token ID
   */
  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = this.buildKey(userId, tokenId);

    try {
      await this.redis.del(key);
      logger.info('Refresh token revoked', { userId, tokenId });
    } catch (error) {
      logger.error('Failed to revoke refresh token', error as Error, { userId, tokenId });
      throw new Error('Failed to revoke refresh token');
    }
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   *
   * @param userId - User ID
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const pattern = `${this.KEY_PREFIX}:${userId}:*`;

    try {
      // Find all keys matching the pattern
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('All user tokens revoked', { userId, count: keys.length });
      } else {
        logger.info('No tokens found to revoke', { userId });
      }
    } catch (error) {
      logger.error('Failed to revoke all user tokens', error as Error, { userId });
      throw new Error('Failed to revoke all user tokens');
    }
  }

  /**
   * Get count of active tokens for a user
   *
   * @param userId - User ID
   * @returns Number of active tokens
   */
  async getUserTokenCount(userId: string): Promise<number> {
    const pattern = `${this.KEY_PREFIX}:${userId}:*`;

    try {
      const keys = await this.redis.keys(pattern);
      return keys.length;
    } catch (error) {
      logger.error('Failed to get user token count', error as Error, { userId });
      return 0;
    }
  }

  /**
   * Build Redis key for a token
   */
  private buildKey(userId: string, tokenId: string): string {
    return `${this.KEY_PREFIX}:${userId}:${tokenId}`;
  }
}
