import { DomainEvent } from '@/domain/shared/DomainEvent';

export class CallClaimedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly operatorId: string,
    public readonly operatorEmail: string,
    public readonly queueWaitTime: number, // in seconds
    correlationId?: string
  ) {
    super(correlationId);
  }
}
