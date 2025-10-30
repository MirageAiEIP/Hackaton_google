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
  findById(id: string): Promise<QueueEntry | null>;

  findByCallId(callId: string): Promise<QueueEntry | null>;

  findWaiting(): Promise<QueueEntry[]>;

  findByOperator(operatorId: string): Promise<QueueEntry[]>;

  save(entry: QueueEntry): Promise<void>;

  claim(entryId: string, operatorId: string): Promise<void>;

  delete(id: string): Promise<void>;
}
