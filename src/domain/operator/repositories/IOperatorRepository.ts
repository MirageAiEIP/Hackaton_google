import { Operator, OperatorStatus } from '../entities/Operator.entity';

/**
 * Operator Repository Interface (Port)
 * Defines contract for operator data access
 */
export interface IOperatorRepository {
  /**
   * Find operator by ID
   */
  findById(id: string): Promise<Operator | null>;

  /**
   * Find operator by email
   */
  findByEmail(email: string): Promise<Operator | null>;

  /**
   * Get all operators with specific status
   */
  findByStatus(status: OperatorStatus): Promise<Operator[]>;

  /**
   * Get all available operators (status=AVAILABLE and no current call)
   */
  findAvailable(): Promise<Operator[]>;

  /**
   * Get all operators
   */
  findAll(): Promise<Operator[]>;

  /**
   * Save operator (create or update)
   */
  save(operator: Operator): Promise<void>;

  /**
   * Delete operator
   */
  delete(id: string): Promise<void>;

  /**
   * Get operator statistics
   */
  getStats(operatorId: string): Promise<{
    totalCallsHandled: number;
    averageHandleTime: number;
    currentStatus: OperatorStatus;
  } | null>;
}
