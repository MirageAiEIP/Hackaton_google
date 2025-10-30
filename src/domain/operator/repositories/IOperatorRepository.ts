import { Operator, OperatorStatus } from '../entities/Operator.entity';

export interface IOperatorRepository {
  findById(id: string): Promise<Operator | null>;

  findByEmail(email: string): Promise<Operator | null>;

  findByStatus(status: OperatorStatus): Promise<Operator[]>;

  findAvailable(): Promise<Operator[]>;

  findAll(): Promise<Operator[]>;

  save(operator: Operator): Promise<void>;

  delete(id: string): Promise<void>;

  getStats(operatorId: string): Promise<{
    totalCallsHandled: number;
    averageHandleTime: number;
    currentStatus: OperatorStatus;
  } | null>;
}
