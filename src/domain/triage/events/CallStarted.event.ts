import { DomainEvent } from '@/domain/shared/DomainEvent';

export class CallStartedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly phoneNumber: string,
    correlationId?: string
  ) {
    super(correlationId);
  }
}
