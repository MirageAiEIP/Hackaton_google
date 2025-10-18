import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { RedisEventBus } from './RedisEventBus';
import { DomainEvent } from '@/domain/shared/DomainEvent';
import { IEventHandler } from '@/domain/shared/IEventBus';

// Test event
class TestEvent extends DomainEvent {
  constructor(public readonly data: string) {
    super();
  }
}

// Test handler
class TestHandler implements IEventHandler<TestEvent> {
  public handledEvents: TestEvent[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

describe('RedisEventBus', () => {
  let eventBus: RedisEventBus;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  beforeAll(() => {
    eventBus = new RedisEventBus(redisUrl);
  });

  afterAll(async () => {
    await eventBus.disconnect();
  });

  it('should publish and receive events', async () => {
    // Arrange
    const handler = new TestHandler();
    const testData = 'test-data-' + Date.now();

    // Act
    await eventBus.subscribe('TestEvent', handler);

    // Wait for subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    const event = new TestEvent(testData);
    await eventBus.publish(event);

    // Wait for event to be received
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(handler.handledEvents.length).toBe(1);
    expect(handler.handledEvents[0].data).toBe(testData);
  });

  it('should call multiple handlers for the same event', async () => {
    // Arrange
    const handler1 = new TestHandler();
    const handler2 = new TestHandler();
    const testData = 'multi-handler-' + Date.now();

    // Act
    await eventBus.subscribe('TestEvent', handler1);
    await eventBus.subscribe('TestEvent', handler2);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const event = new TestEvent(testData);
    await eventBus.publish(event);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(handler1.handledEvents.length).toBeGreaterThan(0);
    expect(handler2.handledEvents.length).toBeGreaterThan(0);
  });

  it('should handle event handler failures gracefully', async () => {
    // Arrange
    const failingHandler: IEventHandler = {
      async handle() {
        throw new Error('Handler failed');
      },
    };

    const successHandler = new TestHandler();

    // Act
    await eventBus.subscribe('TestEvent', failingHandler);
    await eventBus.subscribe('TestEvent', successHandler);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const event = new TestEvent('failure-test-' + Date.now());

    // Should not throw
    await expect(eventBus.publish(event)).resolves.not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Success handler should still work
    expect(successHandler.handledEvents.length).toBeGreaterThan(0);
  });
});
