import { DomainEvent } from '@/domain/shared/DomainEvent';

export class DispatchStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly dispatchId: string,
    public readonly callId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly location: { latitude: number; longitude: number } | null,
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
      previousStatus: this.previousStatus,
      newStatus: this.newStatus,
      location: this.location,
      correlationId: this.correlationId,
    };
  }
}
