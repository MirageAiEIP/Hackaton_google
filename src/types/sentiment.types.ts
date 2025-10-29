export type SentimentType = 'CALM' | 'ANXIOUS' | 'PANICKED' | 'CONFUSED' | 'IN_PAIN';

export type UrgencyMarker =
  | 'SEVERE_PAIN_LANGUAGE'
  | 'TEMPORAL_URGENCY'
  | 'DEATH_ANXIETY'
  | 'REPETITIONS'
  | 'HESITATIONS'
  | 'SHOUTING';

export type ClinicalIndicator =
  | 'DYSPNEA'
  | 'WEAKNESS'
  | 'CONFUSION'
  | 'PAIN_VOCALIZATION'
  | 'PANIC'
  | 'DISTRESS'
  | 'ALTERED_CONSCIOUSNESS';

export type ProsodyClassification = 'NORMAL' | 'HIGH' | 'LOW' | 'TREMBLING';
export type TempoClassification = 'NORMAL' | 'FAST' | 'SLOW';
export type VolumeClassification = 'NORMAL' | 'WEAK' | 'LOUD';

export type CoherenceType = 'COHERENT' | 'INCOHERENT';
export type RecommendationType = 'INCREASE_PRIORITY' | 'MAINTAIN' | 'DECREASE_PRIORITY';

export interface TextAnalysis {
  sentiment: SentimentType;
  stressLevel: number; // 0-100
  urgencyMarkers: UrgencyMarker[];
  painLanguage: number; // 0-100
  coherence: number; // 0-100
  confidence: number; // 0-1
}

export interface ProsodyAnalysis {
  pitch: {
    mean: number; // Hz
    variance: number;
    classification: ProsodyClassification;
  };
  tempo: {
    wordsPerMinute: number;
    classification: TempoClassification;
  };
  volume: {
    mean: number; // dB
    classification: VolumeClassification;
  };
}

export interface PauseAnalysis {
  frequency: number; // Pauses per minute
  avgDuration: number; // ms
  longPauses: number; // Count of pauses > 3s
}

export interface AudioEmotionDimensions {
  arousal: number; // 0-1 (calm → stressed)
  dominance: number; // 0-1 (weak → strong)
}

export interface AudioAnalysis {
  prosody: ProsodyAnalysis;
  breathiness: number; // 0-100
  pauses: PauseAnalysis;
  vocalStress: number; // 0-100
  clinicalIndicators: ClinicalIndicator[];
  confidence: number; // 0-1
  emotionDimensions?: AudioEmotionDimensions; // From HF model
}

export interface HybridAnalysis {
  textScore: number; // 0-100
  audioScore: number; // 0-100
  finalScore: number; // 0-100
  coherence: CoherenceType;
  recommendation: RecommendationType;
  pointsAdjustment: number; // Points to add to questionnaire score
  confidence: number; // 0-1
  reasoning: string;
}

export interface SentimentAnalysisInput {
  callId: string;
  transcript: string;
  audioUrl?: string;
}

export interface SemanticAnalysis {
  sentiment: SentimentType;
  painIntensity: number; // 0-100
  coherence: number; // 0-100
  confidence: number; // 0-1
  reasoning: string;
}
