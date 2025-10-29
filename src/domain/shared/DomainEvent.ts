import { randomUUID } from 'crypto';

export abstract class DomainEvent {
  public readonly id: string;
  public readonly occurredAt: Date;
  public readonly correlationId?: string;

  constructor(correlationId?: string) {
    this.id = randomUUID();
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }

  get eventName(): string {
    return this.constructor.name;
  }
}
