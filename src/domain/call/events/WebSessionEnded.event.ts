import { DomainEvent } from '@/domain/shared/DomainEvent';

export class WebSessionEndedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly sessionId: string,
    public readonly reason: string
  ) {
    super();
  }

  getEventName(): string {
    return 'WebSessionEndedEvent';
  }

  toJSON() {
    return {
      eventName: this.getEventName(),
      callId: this.callId,
      sessionId: this.sessionId,
      reason: this.reason,
      timestamp: this.occurredAt.toISOString(),
    };
  }
}
