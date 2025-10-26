import { PriorityLevel, QueueStatus } from '@prisma/client';

/**
 * WebSocket message types for Queue Dashboard
 */

// Outgoing messages (server -> client)
export interface QueueInitialMessage {
  type: 'queue:initial';
  data: QueueEntryData[];
}

export interface QueueAddedMessage {
  type: 'queue:added';
  data: QueueEntryData;
}

export interface QueueUpdatedMessage {
  type: 'queue:updated';
  data: QueueUpdateData;
}

export interface QueueRemovedMessage {
  type: 'queue:removed';
  data: {
    id: string;
  };
}

export interface QueueErrorMessage {
  type: 'queue:error';
  error: {
    code: string;
    message: string;
  };
}

export interface QueuePongMessage {
  type: 'queue:pong';
  timestamp: string;
}

// Incoming messages (client -> server)
export interface QueuePingMessage {
  type: 'queue:ping';
}

export interface QueueSubscribeMessage {
  type: 'queue:subscribe';
}

export type QueueIncomingMessage = QueuePingMessage | QueueSubscribeMessage;

export type QueueOutgoingMessage =
  | QueueInitialMessage
  | QueueAddedMessage
  | QueueUpdatedMessage
  | QueueRemovedMessage
  | QueueErrorMessage
  | QueuePongMessage;

/**
 * Queue Entry Data (sent to dashboard)
 */
export interface QueueEntryData {
  id: string;
  callId: string;

  // Patient info summary
  priority: PriorityLevel;
  chiefComplaint: string;
  patientAge: number | null;
  patientGender: string | null;
  location: string | null;

  // AI summary for operator
  aiSummary: string;
  aiRecommendation: string;
  keySymptoms: string[];
  redFlags: string[];

  // Queue management
  status: QueueStatus;
  waitingSince: string; // ISO timestamp
  waitingTimeSeconds: number; // Calculated

  // Operator assignment
  claimedBy: string | null;
  claimedAt: string | null;

  // Conversation ID (for linking to ElevenLabs)
  conversationId: string | null;
}

/**
 * Queue Update Data (partial update)
 */
export interface QueueUpdateData {
  id: string;
  status: QueueStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  waitingTimeSeconds: number;
}
