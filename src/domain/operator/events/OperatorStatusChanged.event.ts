import { DomainEvent } from '@/domain/shared/DomainEvent';
import { OperatorStatus } from '../entities/Operator.entity';

/**
 * Domain Event: Operator status changed
 * Published when an operator changes status (AVAILABLE/BUSY/OFFLINE)
 */
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
