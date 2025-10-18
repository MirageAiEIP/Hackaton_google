import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * CallCompletedEvent
 * Published when a call is successfully completed
 */
export class CallCompletedEvent extends DomainEvent {
  public readonly eventName = 'CallCompletedEvent';

  constructor(
    public readonly callId: string,
    public readonly duration: number | null,
    public readonly phoneHash: string,
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
      duration: this.duration,
      phoneHash: this.phoneHash,
      correlationId: this.correlationId,
    };
  }
}
