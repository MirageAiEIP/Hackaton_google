import { randomUUID } from 'crypto';

/**
 * Base class for all domain events
 * Domain events represent something that happened in the domain
 */
export abstract class DomainEvent {
  public readonly id: string;
  public readonly occurredAt: Date;
  public readonly correlationId?: string;

  constructor(correlationId?: string) {
    this.id = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }

  /**
   * Get the event name (class name)
   */
  get eventName(): string {
    return this.constructor.name;
  }
}
