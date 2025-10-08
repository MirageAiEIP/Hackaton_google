export enum PriorityLevel {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
  P5 = 'P5',
}

export enum CallStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum ABCDStatus {
  NORMAL = 'NORMAL',
  COMPROMISED = 'COMPROMISED',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
}

export enum ConsciousnessLevel {
  ALERT = 'ALERT',
  VERBAL = 'VERBAL',
  PAIN = 'PAIN',
  UNRESPONSIVE = 'UNRESPONSIVE',
}

export enum SeverityLevel {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}

export enum RecommendedAction {
  IMMEDIATE_DISPATCH = 'IMMEDIATE_DISPATCH',
  PRIORITY_CALLBACK = 'PRIORITY_CALLBACK',
  SCHEDULED_APPOINTMENT = 'SCHEDULED_APPOINTMENT',
  TELEHEALTH = 'TELEHEALTH',
  SELF_CARE = 'SELF_CARE',
}

export interface IPatientLocation {
  address?: string;
  city?: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  precision: 'exact' | 'approximate' | 'unknown';
}

export interface IPatient {
  id: string;
  phoneHash: string;
  age?: number;
  gender?: string;
  location: IPatientLocation;
  allergies?: string[];
  medications?: string[];
  chronicConditions?: string[];
  recentSurgery?: boolean;
  pregnancy?: boolean;
}

export interface IABCDAssessment {
  airway: {
    status: ABCDStatus;
    details: string;
  };
  breathing: {
    status: ABCDStatus;
    rate?: number;
    details: string;
  };
  circulation: {
    status: ABCDStatus;
    chestPain: boolean;
    bleeding: 'none' | 'minor' | 'major' | 'unknown';
    details: string;
  };
  consciousness: {
    level: ConsciousnessLevel;
    details: string;
  };
}

export interface ISymptom {
  name: string;
  severity: SeverityLevel;
  onset: string;
  evolution: 'stable' | 'improving' | 'worsening';
  details?: string;
}

export interface IRedFlag {
  flag: string;
  severity: 'warning' | 'critical';
  detectedAt: Date;
}

export interface IPriorityClassification {
  level: PriorityLevel;
  score: number;
  confidence: number;
  reasoning: string;
}

export interface IAIRecommendation {
  suggestedAction: RecommendedAction;
  reasoning: string;
  confidence: number;
}

export interface ITriageReport {
  callId: string;
  timestamp: Date;
  duration: number;
  patient: IPatient;
  priority: IPriorityClassification;
  abcdAssessment: IABCDAssessment;
  chiefComplaint: string;
  symptoms: ISymptom[];
  redFlags: IRedFlag[];
  conversation: {
    transcript: string;
    summary: string;
    keyQuotes: string[];
  };
  aiRecommendation: IAIRecommendation;
  metadata: {
    agentVersion: string;
    modelUsed: string;
    processingTime: number;
    qualityScore: number;
  };
}

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface ICallSession {
  id: string;
  status: CallStatus;
  startedAt: Date;
  endedAt?: Date;
  messages: IMessage[];
}

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface IHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    ai: 'up' | 'down';
    redis?: 'up' | 'down';
  };
  uptime: number;
  version: string;
}
