import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * DispatchCreatedEvent
 * Published when SMUR dispatch is created for P0/P1 emergency
 */
export class DispatchCreatedEvent extends DomainEvent {
  public readonly eventName = 'DispatchCreatedEvent';

  constructor(
    public readonly dispatchId: string,
    public readonly callId: string,
    public readonly priority: string,
    public readonly location: { latitude: number; longitude: number } | null,
    public readonly estimatedArrival: string | null,
    correlationId?: string
  ) {
    super(correlationId);
  }

  toJSON() {
    return {
      eventName: this.eventName,
      id: this.id,
      occurredAt: this.occurredAt,
      dispatchId: this.dispatchId,
      callId: this.callId,
      priority: this.priority,
      location: this.location,
      estimatedArrival: this.estimatedArrival,
      correlationId: this.correlationId,
    };
  }
}
