import { DomainEvent } from '@/domain/shared/DomainEvent';

export class QueueEntryAddedEvent extends DomainEvent {
  constructor(
    public readonly queueEntryId: string,
    public readonly callId: string,
    public readonly priority: string,
    public readonly waitTime: number,
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
      priority: this.priority,
      waitTime: this.waitTime,
      correlationId: this.correlationId,
    };
  }
}
