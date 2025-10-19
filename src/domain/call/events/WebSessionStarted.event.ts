import { DomainEvent } from '@/domain/shared/DomainEvent';

export class WebSessionStartedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly sessionId: string,
    public readonly phoneNumber?: string
  ) {
    super();
  }

  getEventName(): string {
    return 'WebSessionStartedEvent';
  }

  toJSON() {
    return {
      eventName: this.getEventName(),
      callId: this.callId,
      sessionId: this.sessionId,
      phoneNumber: this.phoneNumber,
      timestamp: this.occurredAt.toISOString(),
    };
  }
}
