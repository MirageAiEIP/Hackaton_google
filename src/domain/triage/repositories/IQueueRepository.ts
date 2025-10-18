/**
 * Queue Repository Interface (Port)
 * Defines contract for queue entry data access
 */

export interface QueueEntry {
  id: string;
  callId: string;
  priority: string;
  chiefComplaint: string;
  patientAge?: number;
  patientGender?: string;
  location?: string;
  aiSummary: string;
  aiRecommendation: string;
  keySymptoms: string[];
  redFlags: string[];
  status: 'WAITING' | 'CLAIMED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  waitingSince: Date;
  claimedBy?: string;
  claimedAt?: Date;
  estimatedWaitTime?: number;
  conversationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQueueRepository {
  /**
   * Find queue entry by ID
   */
  findById(id: string): Promise<QueueEntry | null>;

  /**
   * Find queue entry by call ID
   */
  findByCallId(callId: string): Promise<QueueEntry | null>;

  /**
   * Get all waiting entries (ordered by priority and wait time)
   */
  findWaiting(): Promise<QueueEntry[]>;

  /**
   * Get entries claimed by specific operator
   */
  findByOperator(operatorId: string): Promise<QueueEntry[]>;

  /**
   * Save queue entry (create or update)
   */
  save(entry: QueueEntry): Promise<void>;

  /**
   * Claim a queue entry for an operator
   */
  claim(entryId: string, operatorId: string): Promise<void>;

  /**
   * Delete queue entry
   */
  delete(id: string): Promise<void>;
}
