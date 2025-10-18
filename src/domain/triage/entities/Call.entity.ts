import { CallStatus } from '@prisma/client';

/**
 * Call Entity (Domain Model)
 * Represents an emergency call in the domain layer
 */
export class Call {
  constructor(
    public readonly id: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly startedAt: Date,
    public readonly status: CallStatus,
    public readonly patientId: string | null,
    public readonly endedAt: Date | null = null,
    public readonly duration: number | null = null,
    public readonly transcript: string | null = null,
    public readonly audioRecordingUrl: string | null = null,
    public readonly agentVersion: string = '1.0.0',
    public readonly modelUsed: string = 'claude-3-5-sonnet',
    public readonly processingTime: number | null = null,
    public readonly qualityScore: number | null = null
  ) {}

  /**
   * Check if call is in progress
   */
  isInProgress(): boolean {
    return this.status === 'IN_PROGRESS';
  }

  /**
   * Check if call is completed
   */
  isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  /**
   * Check if call was escalated
   */
  isEscalated(): boolean {
    return this.status === 'ESCALATED';
  }

  /**
   * Calculate call duration in seconds
   */
  calculateDuration(): number | null {
    if (!this.endedAt) {
      return null;
    }
    return Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      duration: this.duration,
      status: this.status,
      patientId: this.patientId,
      transcript: this.transcript,
      audioRecordingUrl: this.audioRecordingUrl,
      agentVersion: this.agentVersion,
      modelUsed: this.modelUsed,
      processingTime: this.processingTime,
      qualityScore: this.qualityScore,
    };
  }
}
