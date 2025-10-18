import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * HandoffAcceptedEvent
 * Published when an operator accepts a handoff request
 */
export class HandoffAcceptedEvent extends DomainEvent {
  constructor(
    public readonly handoffId: string,
    public readonly queueEntryId: string,
    public readonly operatorId: string,
    public readonly operatorName: string,
    public readonly callId: string,
    correlationId?: string
  ) {
    super(correlationId);
  }

  toJSON() {
    return {
      eventName: this.eventName,
      id: this.id,
      occurredAt: this.occurredAt,
      handoffId: this.handoffId,
      queueEntryId: this.queueEntryId,
      operatorId: this.operatorId,
      operatorName: this.operatorName,
      callId: this.callId,
      correlationId: this.correlationId,
    };
  }
}
