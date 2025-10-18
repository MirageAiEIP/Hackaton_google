import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * QueueEntryStatusChangedEvent
 * Published when a queue entry's status changes (WAITING → CLAIMED → COMPLETED)
 */
export class QueueEntryStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly queueEntryId: string,
    public readonly callId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly operatorId: string | null,
    correlationId?: string
  ) {
    super(correlationId);
  }

  toJSON() {
    return {
      eventName: this.eventName,
      id: this.id,
      occurredAt: this.occurredAt,
      queueEntryId: this.queueEntryId,
      callId: this.callId,
      previousStatus: this.previousStatus,
      newStatus: this.newStatus,
      operatorId: this.operatorId,
      correlationId: this.correlationId,
    };
  }
}
