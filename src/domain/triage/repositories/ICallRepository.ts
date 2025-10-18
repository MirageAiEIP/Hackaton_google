import { Call } from '../entities/Call.entity';

/**
 * Call Repository Interface (Port)
 * Infrastructure layer will provide Prisma implementation
 */
export interface ICallRepository {
  /**
   * Save a call (create or update)
   */
  save(call: Call): Promise<void>;

  /**
   * Find call by ID
   */
  findById(id: string): Promise<Call | null>;

  /**
   * Find calls by phone hash
   */
  findByPhoneHash(phoneHash: string): Promise<Call[]>;

  /**
   * Find all active calls
   */
  findActiveCalls(): Promise<Call[]>;

  /**
   * Delete a call
   */
  delete(id: string): Promise<void>;
}
