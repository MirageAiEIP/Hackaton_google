import { RedisEventBus } from '@/infrastructure/messaging/RedisEventBus';
import { RedisCacheService } from '@/infrastructure/caching/RedisCacheService';
import { logger } from '@/utils/logger';

/**
 * Redis configuration and initialization
 */
export class RedisConfig {
  private static instance: RedisConfig;
  private eventBus: RedisEventBus | null = null;
  private cacheService: RedisCacheService | null = null;

  private constructor() {}

  static getInstance(): RedisConfig {
    if (!RedisConfig.instance) {
      RedisConfig.instance = new RedisConfig();
    }
    return RedisConfig.instance;
  }

  /**
   * Initialize Redis services
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    logger.info('Initializing Redis services', {
      redisUrl: redisUrl.replace(/\/\/.*@/, '//***@'),
    });

    try {
      // Initialize Event Bus
      this.eventBus = new RedisEventBus(redisUrl);

      // Initialize Cache Service
      this.cacheService = new RedisCacheService(redisUrl);

      logger.info('Redis services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis services', error as Error);
      throw error;
    }
  }

  /**
   * Get Event Bus instance
   */
  getEventBus(): RedisEventBus {
    if (!this.eventBus) {
      throw new Error('Redis Event Bus not initialized. Call initialize() first.');
    }
    return this.eventBus;
  }

  /**
   * Get Cache Service instance
   */
  getCacheService(): RedisCacheService {
    if (!this.cacheService) {
      throw new Error('Redis Cache Service not initialized. Call initialize() first.');
    }
    return this.cacheService;
  }

  /**
   * Shutdown Redis connections
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Redis services');

    if (this.eventBus) {
      await this.eventBus.disconnect();
    }

    if (this.cacheService) {
      await this.cacheService.disconnect();
    }

    logger.info('Redis services shut down');
  }
}
