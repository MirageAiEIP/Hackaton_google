import { PriorityLevel, QueueStatus } from '@prisma/client';

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

export interface QueueTranscriptUpdatedMessage {
  type: 'queue:transcript-updated';
  data: {
    callId: string;
    transcript: string;
    lastUpdate: string;
  };
}

// Incoming messages (client -> server)
export interface QueuePingMessage {
  type: 'queue:ping';
}

export interface QueueSubscribeMessage {
  type: 'queue:subscribe';
}

export interface QueueSubscribeTranscriptMessage {
  type: 'queue:subscribe-transcript';
  callId: string;
}

export interface QueueUnsubscribeTranscriptMessage {
  type: 'queue:unsubscribe-transcript';
  callId: string;
}

export type QueueIncomingMessage =
  | QueuePingMessage
  | QueueSubscribeMessage
  | QueueSubscribeTranscriptMessage
  | QueueUnsubscribeTranscriptMessage;

export type QueueOutgoingMessage =
  | QueueInitialMessage
  | QueueAddedMessage
  | QueueUpdatedMessage
  | QueueRemovedMessage
  | QueueErrorMessage
  | QueuePongMessage
  | QueueTranscriptUpdatedMessage;

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

export interface QueueUpdateData {
  id: string;
  status: QueueStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  waitingTimeSeconds: number;
}
