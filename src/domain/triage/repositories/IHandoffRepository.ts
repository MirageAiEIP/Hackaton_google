/**
 * Handoff Repository Interface (Port)
 * Defines contract for handoff data access
 */

export interface Handoff {
  id: string;
  callId: string;
  fromAgent: boolean;
  toOperatorId: string;
  reason: string;
  conversationId?: string;
  transcript: string;
  aiContext: unknown;
  patientSummary: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  requestedAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  handoffDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHandoffRepository {
  /**
   * Find handoff by ID
   */
  findById(id: string): Promise<Handoff | null>;

  /**
   * Find handoff by call ID
   */
  findByCallId(callId: string): Promise<Handoff | null>;

  /**
   * Find all pending handoffs (status=REQUESTED)
   */
  findPending(): Promise<Handoff[]>;

  /**
   * Find handoffs for specific operator
   */
  findByOperator(operatorId: string): Promise<Handoff[]>;

  /**
   * Save handoff (create or update)
   */
  save(handoff: Handoff): Promise<void>;

  /**
   * Accept handoff
   */
  accept(handoffId: string, operatorId: string): Promise<void>;

  /**
   * Complete handoff
   */
  complete(handoffId: string): Promise<void>;

  /**
   * Reject handoff
   */
  reject(handoffId: string, reason: string): Promise<void>;

  /**
   * Delete handoff
   */
  delete(id: string): Promise<void>;
}
