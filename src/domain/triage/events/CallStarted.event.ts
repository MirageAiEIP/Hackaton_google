import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * Domain Event: Call Started
 * Published when a new emergency call is initiated
 */
export class CallStartedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly phoneNumber: string,
    correlationId?: string
  ) {
    super(correlationId);
  }
}
