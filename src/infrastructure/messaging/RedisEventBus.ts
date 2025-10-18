import Redis from 'ioredis';
import { DomainEvent } from '@/domain/shared/DomainEvent';
import { IEventBus, IEventHandler } from '@/domain/shared/IEventBus';
import { logger } from '@/utils/logger';

/**
 * Redis-based Event Bus implementation
 * Supports horizontal scaling via Redis Pub/Sub
 */
export class RedisEventBus implements IEventBus {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, IEventHandler[]>();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on('message', async (channel: string, message: string) => {
      await this.handleMessage(channel, message);
    });

    logger.info('RedisEventBus initialized', { redisUrl: redisUrl.replace(/\/\/.*@/, '//***@') });
  }

  /**
   * Publish an event to all subscribers
   */
  async publish(event: DomainEvent): Promise<void> {
    const channel = `events:${event.eventName}`;
    const message = JSON.stringify(event);

    try {
      const subscriberCount = await this.publisher.publish(channel, message);

      logger.info('Event published', {
        eventName: event.eventName,
        eventId: event.id,
        correlationId: event.correlationId,
        subscriberCount,
      });
    } catch (error) {
      logger.error('Failed to publish event', error as Error, {
        eventName: event.eventName,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Subscribe to an event type
   */
  async subscribe(eventName: string, handler: IEventHandler): Promise<void> {
    const channel = `events:${eventName}`;

    // Store handler
    const existingHandlers = this.handlers.get(eventName) || [];
    existingHandlers.push(handler);
    this.handlers.set(eventName, existingHandlers);

    // Subscribe to channel (only once per event type)
    if (existingHandlers.length === 1) {
      await this.subscriber.subscribe(channel);
      logger.info('Subscribed to event', { eventName, channel });
    }
  }

  /**
   * Handle incoming message from Redis
   */
  private async handleMessage(channel: string, message: string): Promise<void> {
    const eventName = channel.replace('events:', '');
    const handlers = this.handlers.get(eventName);

    if (!handlers || handlers.length === 0) {
      logger.warn('No handlers registered for event', { eventName, channel });
      return;
    }

    try {
      const event = JSON.parse(message) as DomainEvent;

      logger.debug('Processing event', {
        eventName,
        eventId: event.id,
        handlerCount: handlers.length,
      });

      // Execute all handlers in parallel
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler.handle(event);
          } catch (error) {
            logger.error('Event handler failed', error as Error, {
              eventName,
              eventId: event.id,
              handlerName: handler.constructor.name,
            });
            // Don't throw - other handlers should still execute
          }
        })
      );
    } catch (error) {
      logger.error('Failed to parse event message', error as Error, {
        channel,
        message: message.substring(0, 100),
      });
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    logger.info('RedisEventBus disconnected');
  }
}
