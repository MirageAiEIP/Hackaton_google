import { PrismaClient } from '@prisma/client';
import { RedisConfig } from '@/infrastructure/config/redis.config';
import { RedisEventBus } from '@/infrastructure/messaging/RedisEventBus';
import { RedisCacheService } from '@/infrastructure/caching/RedisCacheService';
import { PrismaCallRepository } from '@/infrastructure/repositories/PrismaCallRepository';
import { PrismaOperatorRepository } from '@/infrastructure/repositories/PrismaOperatorRepository';
import { PrismaQueueRepository } from '@/infrastructure/repositories/PrismaQueueRepository';
import { PrismaHandoffRepository } from '@/infrastructure/repositories/PrismaHandoffRepository';
import { CallStartedHandler } from '@/application/events/CallStartedHandler';
import { logger } from '@/utils/logger';

/**
 * Dependency Injection Container
 * Manages lifecycle and dependencies of all services
 */
export class Container {
  private static instance: Container;
  private initialized = false;

  // Infrastructure
  private prisma!: PrismaClient;
  private redisConfig!: RedisConfig;
  private eventBus!: RedisEventBus;
  private cacheService!: RedisCacheService;

  // Repositories
  private callRepository!: PrismaCallRepository;
  private operatorRepository!: PrismaOperatorRepository;
  private queueRepository!: PrismaQueueRepository;
  private handoffRepository!: PrismaHandoffRepository;

  // Event Handlers
  private callStartedHandler!: CallStartedHandler;

  private constructor() {}

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Container already initialized');
      return;
    }

    logger.info('Initializing DI Container');

    try {
      // 1. Initialize infrastructure layer
      await this.initializeInfrastructure();

      // 2. Initialize repositories
      this.initializeRepositories();

      // 3. Initialize event handlers
      await this.initializeEventHandlers();

      this.initialized = true;
      logger.info('DI Container initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DI Container', error as Error);
      throw error;
    }
  }

  /**
   * Initialize infrastructure services
   */
  private async initializeInfrastructure(): Promise<void> {
    // Prisma
    this.prisma = new PrismaClient();
    await this.prisma.$connect();
    logger.info('Prisma connected');

    // Redis
    this.redisConfig = RedisConfig.getInstance();
    await this.redisConfig.initialize();

    this.eventBus = this.redisConfig.getEventBus();
    this.cacheService = this.redisConfig.getCacheService();
  }

  /**
   * Initialize repositories
   */
  private initializeRepositories(): void {
    this.callRepository = new PrismaCallRepository(this.prisma);
    this.operatorRepository = new PrismaOperatorRepository(this.prisma);
    this.queueRepository = new PrismaQueueRepository(this.prisma);
    this.handoffRepository = new PrismaHandoffRepository(this.prisma);
  }

  /**
   * Initialize and register event handlers
   */
  private async initializeEventHandlers(): Promise<void> {
    // Create event handlers
    this.callStartedHandler = new CallStartedHandler();

    // Register handlers with event bus
    await this.eventBus.subscribe('CallStartedEvent', this.callStartedHandler);

    logger.info('Event handlers registered');
  }

  /**
   * Getters for services
   */
  getPrisma(): PrismaClient {
    this.ensureInitialized();
    return this.prisma;
  }

  getEventBus(): RedisEventBus {
    this.ensureInitialized();
    return this.eventBus;
  }

  getCacheService(): RedisCacheService {
    this.ensureInitialized();
    return this.cacheService;
  }

  getCallRepository(): PrismaCallRepository {
    this.ensureInitialized();
    return this.callRepository;
  }

  getOperatorRepository(): PrismaOperatorRepository {
    this.ensureInitialized();
    return this.operatorRepository;
  }

  getQueueRepository(): PrismaQueueRepository {
    this.ensureInitialized();
    return this.queueRepository;
  }

  getHandoffRepository(): PrismaHandoffRepository {
    this.ensureInitialized();
    return this.handoffRepository;
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down DI Container');

    // Disconnect Redis
    if (this.redisConfig) {
      await this.redisConfig.shutdown();
    }

    // Disconnect Prisma
    if (this.prisma) {
      await this.prisma.$disconnect();
      logger.info('Prisma disconnected');
    }

    this.initialized = false;
    logger.info('DI Container shut down');
  }

  /**
   * Ensure container is initialized before accessing services
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Container not initialized. Call initialize() first.');
    }
  }
}
