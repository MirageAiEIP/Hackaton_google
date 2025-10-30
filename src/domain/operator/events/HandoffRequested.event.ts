import { DomainEvent } from '@/domain/shared/DomainEvent';

export class HandoffRequestedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly conversationId: string,
    public readonly reason: string,
    public readonly fromAgent: boolean, // true if AI initiated, false if patient requested
    public readonly priority: string,
    correlationId?: string
  ) {
    super(correlationId);
  }
}
