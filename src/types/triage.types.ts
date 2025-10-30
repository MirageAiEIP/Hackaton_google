import type {
  PriorityLevel,
  CallStatus,
  ABCDStatus,
  ConsciousnessLevel,
  RecommendedAction,
  SeverityLevel,
} from '@prisma/client';

// Re-export Prisma types for use in other modules
export type {
  PriorityLevel,
  CallStatus,
  ABCDStatus,
  ConsciousnessLevel,
  RecommendedAction,
  SeverityLevel,
};

export interface TriageMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sentimentScore?: number;
  detectedSymptoms?: string[];
  detectedRedFlags?: string[];
  priorityAtTime?: PriorityLevel;
}

export interface TriageSession {
  callId: string;
  patientId?: string;
  status: CallStatus;
  currentPriority: PriorityLevel;
  confidenceScore: number;
  messages: TriageMessage[];
  detectedSymptoms: DetectedSymptom[];
  detectedRedFlags: DetectedRedFlag[];
  abcdAssessment: ABCDAssessment;
  metadata: TriageMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedSymptom {
  name: string;
  severity: SeverityLevel;
  onset: string;
  evolution: string;
  detectedAt: Date;
  confidence: number;
  mentionedInMessages: number[];
}

export interface DetectedRedFlag {
  flag: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  category: 'AIRWAY' | 'BREATHING' | 'CIRCULATION' | 'CONSCIOUSNESS' | 'OTHER';
  detectedAt: Date;
  triggerKeywords: string[];
  confidence: number;
}

export interface ABCDAssessment {
  airway: {
    status: ABCDStatus;
    details: string;
    concernLevel: number;
  };
  breathing: {
    status: ABCDStatus;
    rate?: number;
    details: string;
    concernLevel: number;
  };
  circulation: {
    status: ABCDStatus;
    chestPain: boolean;
    bleeding?: string;
    details: string;
    concernLevel: number;
  };
  disability: {
    consciousnessLevel: ConsciousnessLevel;
    details: string;
    concernLevel: number;
  };
  overallScore: number;
}

export interface TriageMetadata {
  agentVersion: string;
  modelUsed: string;
  startedAt: Date;
  totalDuration?: number;
  audioRecordingUrl?: string;
  escalatedAt?: Date;
  escalationReason?: string;
}

export interface TriageDecision {
  priorityLevel: PriorityLevel;
  confidence: number;
  reasoning: string;
  recommendedAction: RecommendedAction;
  recommendationReasoning: string;
  chiefComplaint: string;
  conversationSummary: string;
  keyQuotes: string[];
  urgencyFactors: string[];
  mitigatingFactors: string[];
}

export interface TriageToolContext {
  callId: string;
  currentSession: TriageSession;
  lastUserMessage: string;
  conversationHistory: TriageMessage[];
}

export interface PriorityAnalysisResult {
  suggestedPriority: PriorityLevel;
  confidence: number;
  reasoning: string;
  shouldEscalate: boolean;
  criticalFactors: string[];
  abcdConcerns: {
    airway: number;
    breathing: number;
    circulation: number;
    disability: number;
  };
}

export interface ABCDQuestion {
  category: 'AIRWAY' | 'BREATHING' | 'CIRCULATION' | 'DISABILITY';
  question: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  reasoning: string;
  expectedInfo: string[];
}

export interface CreateCallPayload {
  phoneNumber: string;
  initialMessage?: string;
  patientInfo?: {
    age?: number;
    gender?: string;
    address?: string;
    city?: string;
    postalCode?: string;
  };
  audioUrl?: string;
}

export interface ContinueCallPayload {
  callId: string;
  message: string;
  audioUrl?: string;
}

export interface AgentResponse {
  message: string;
  currentPriority: PriorityLevel;
  confidence: number;
  shouldEscalate: boolean;
  detectedSymptoms: string[];
  detectedRedFlags: string[];
  nextQuestions?: string[];
  metadata: {
    processingTime: number;
    sentimentScore?: number;
    abcdConcerns: Record<string, number>;
  };
}

export interface TriageServiceConfig {
  enableAudioAnalysis: boolean;
  enableMemory: boolean;
  autoEscalateP0: boolean;
  maxConversationTurns: number;
  minConfidenceForDecision: number;
}
