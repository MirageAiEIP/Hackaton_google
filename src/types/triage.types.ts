import type {
  PriorityLevel,
  CallStatus,
  ABCDStatus,
  ConsciousnessLevel,
  RecommendedAction,
  SeverityLevel,
} from '@prisma/client';

// Re-export Prisma types for use in other modules
export type { PriorityLevel, CallStatus, ABCDStatus, ConsciousnessLevel, RecommendedAction, SeverityLevel };

/**
 * Message d'un échange dans la conversation de triage
 */
export interface TriageMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sentimentScore?: number;
  detectedSymptoms?: string[];
  detectedRedFlags?: string[];
  priorityAtTime?: PriorityLevel;
}

/**
 * État complet d'une session de triage
 */
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

/**
 * Symptôme détecté durant le triage
 */
export interface DetectedSymptom {
  name: string;
  severity: SeverityLevel;
  onset: string;
  evolution: string;
  detectedAt: Date;
  confidence: number;
  mentionedInMessages: number[];
}

/**
 * Drapeau rouge détecté (urgence vitale)
 */
export interface DetectedRedFlag {
  flag: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  category: 'AIRWAY' | 'BREATHING' | 'CIRCULATION' | 'CONSCIOUSNESS' | 'OTHER';
  detectedAt: Date;
  triggerKeywords: string[];
  confidence: number;
}

/**
 * Évaluation ABCD complète
 */
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

/**
 * Métadonnées de la session
 */
export interface TriageMetadata {
  agentVersion: string;
  modelUsed: string;
  startedAt: Date;
  totalDuration?: number;
  audioRecordingUrl?: string;
  escalatedAt?: Date;
  escalationReason?: string;
}

/**
 * Décision de triage finale
 */
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

/**
 * Contexte pour les outils de l'agent
 */
export interface TriageToolContext {
  callId: string;
  currentSession: TriageSession;
  lastUserMessage: string;
  conversationHistory: TriageMessage[];
}

/**
 * Résultat d'analyse de priorité
 */
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

/**
 * Question ABCD à poser
 */
export interface ABCDQuestion {
  category: 'AIRWAY' | 'BREATHING' | 'CIRCULATION' | 'DISABILITY';
  question: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  reasoning: string;
  expectedInfo: string[];
}

/**
 * Payload pour créer un nouvel appel
 */
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

/**
 * Payload pour continuer une conversation
 */
export interface ContinueCallPayload {
  callId: string;
  message: string;
  audioUrl?: string;
}

/**
 * Réponse de l'agent
 */
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

/**
 * Options de configuration pour le service de triage
 */
export interface TriageServiceConfig {
  enableAudioAnalysis: boolean;
  enableMemory: boolean;
  autoEscalateP0: boolean;
  maxConversationTurns: number;
  minConfidenceForDecision: number;
}
