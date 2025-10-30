import { DomainEvent } from '@/domain/shared/DomainEvent';

export class CallCancelledEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly phoneHash: string,
    public readonly reason: string | null,
    correlationId?: string
  ) {
    super(correlationId);
  }

  toJSON() {
    return {
      eventName: this.eventName,
      id: this.id,
      occurredAt: this.occurredAt,
      callId: this.callId,
      phoneHash: this.phoneHash,
      reason: this.reason,
      correlationId: this.correlationId,
    };
  }
}
