export interface Handoff {
  id: string;
  callId: string;
  fromAgent: boolean;
  toOperatorId?: string | null;
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
  findById(id: string): Promise<Handoff | null>;

  findByCallId(callId: string): Promise<Handoff | null>;

  findPending(): Promise<Handoff[]>;

  findByOperator(operatorId: string): Promise<Handoff[]>;

  save(handoff: Handoff): Promise<void>;

  accept(handoffId: string, operatorId: string): Promise<void>;

  complete(handoffId: string): Promise<void>;

  reject(handoffId: string, reason: string): Promise<void>;

  delete(id: string): Promise<void>;
}
