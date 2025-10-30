import { DomainEvent } from '@/domain/shared/DomainEvent';
import { OperatorStatus } from '../entities/Operator.entity';

export class OperatorStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly operatorId: string,
    public readonly operatorEmail: string,
    public readonly previousStatus: OperatorStatus,
    public readonly newStatus: OperatorStatus,
    correlationId?: string
  ) {
    super(correlationId);
  }
}
