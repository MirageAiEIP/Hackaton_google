import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import type {
  Call,
  Patient,
  TriageReport,
  Symptom,
  RedFlag,
  CallStatus,
  PriorityLevel,
} from '@prisma/client';
import type {
  CreateCallPayload,
  TriageSession,
  DetectedSymptom,
  DetectedRedFlag,
  TriageDecision,
} from '@/types/triage.types';
import crypto from 'crypto';

/**
 * Service responsable des opérations CRUD sur les appels et entités liées
 * Couche Infrastructure - encapsule Prisma
 */
export class CallService {
  /**
   * Hash un numéro de téléphone pour anonymisation RGPD
   */
  private hashPhoneNumber(phoneNumber: string): string {
    return crypto.createHash('sha256').update(phoneNumber).digest('hex');
  }

  /**
   * Récupère ou crée un patient basé sur son numéro de téléphone
   */
  async findOrCreatePatient(payload: CreateCallPayload): Promise<Patient> {
    const phoneHash = this.hashPhoneNumber(payload.phoneNumber);

    let patient = await prisma.patient.findUnique({
      where: { phoneHash },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          phoneHash,
          age: payload.patientInfo?.age,
          gender: payload.patientInfo?.gender,
          address: payload.patientInfo?.address,
          city: payload.patientInfo?.city,
          postalCode: payload.patientInfo?.postalCode,
        },
      });

      logger.info('New patient created', { patientId: patient.id, phoneHash });
    } else {
      logger.info('Existing patient found', { patientId: patient.id });
    }

    return patient;
  }

  /**
   * Crée un nouvel appel en base de données
   */
  async createCall(payload: CreateCallPayload): Promise<Call> {
    const patient = await this.findOrCreatePatient(payload);

    const call = await prisma.call.create({
      data: {
        patientId: patient.id,
        status: 'IN_PROGRESS',
        transcript: payload.initialMessage || '',
        audioRecordingUrl: payload.audioUrl,
        startedAt: new Date(),
      },
      include: {
        patient: true,
      },
    });

    logger.info('Call created', {
      callId: call.id,
      patientId: patient.id,
      status: call.status,
    });

    return call;
  }

  /**
   * Récupère un appel avec toutes ses relations
   */
  async getCallById(callId: string): Promise<Call | null> {
    return prisma.call.findUnique({
      where: { id: callId },
      include: {
        patient: true,
        triageReport: true,
        symptoms: true,
        redFlags: true,
      },
    });
  }

  /**
   * Met à jour le transcript de l'appel
   */
  async updateTranscript(callId: string, newMessage: string): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { transcript: true },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    const updatedTranscript = call.transcript ? `${call.transcript}\n\n${newMessage}` : newMessage;

    await prisma.call.update({
      where: { id: callId },
      data: {
        transcript: updatedTranscript,
        updatedAt: new Date(),
      },
    });

    logger.debug('Transcript updated', { callId });
  }

  /**
   * Met à jour le statut de l'appel
   */
  async updateCallStatus(
    callId: string,
    status: CallStatus,
    metadata?: { duration?: number; qualityScore?: number; processingTime?: number }
  ): Promise<void> {
    const updateData: {
      status: CallStatus;
      updatedAt: Date;
      endedAt?: Date;
      duration?: number;
      qualityScore?: number;
      processingTime?: number;
    } = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'COMPLETED' || status === 'ESCALATED' || status === 'CANCELLED') {
      updateData.endedAt = new Date();
    }

    if (metadata) {
      Object.assign(updateData, metadata);
    }

    await prisma.call.update({
      where: { id: callId },
      data: updateData,
    });

    logger.info('Call status updated', { callId, status });
  }

  /**
   * Enregistre un symptôme détecté
   */
  async createSymptom(callId: string, symptom: DetectedSymptom): Promise<Symptom> {
    return prisma.symptom.create({
      data: {
        callId,
        name: symptom.name,
        severity: symptom.severity,
        onset: symptom.onset,
        evolution: symptom.evolution,
        details: `Confidence: ${symptom.confidence}. Detected at: ${symptom.detectedAt.toISOString()}`,
        detectedAt: symptom.detectedAt,
      },
    });
  }

  /**
   * Enregistre un drapeau rouge
   */
  async createRedFlag(callId: string, redFlag: DetectedRedFlag): Promise<RedFlag> {
    return prisma.redFlag.create({
      data: {
        callId,
        flag: redFlag.flag,
        severity: redFlag.severity,
        detectedAt: redFlag.detectedAt,
      },
    });
  }

  /**
   * Enregistre tous les symptômes en batch
   */
  async createSymptomsBatch(callId: string, symptoms: DetectedSymptom[]): Promise<void> {
    if (symptoms.length === 0) {
      return;
    }

    await prisma.symptom.createMany({
      data: symptoms.map((symptom) => ({
        callId,
        name: symptom.name,
        severity: symptom.severity,
        onset: symptom.onset,
        evolution: symptom.evolution,
        details: `Confidence: ${symptom.confidence}`,
        detectedAt: symptom.detectedAt,
      })),
    });

    logger.info('Symptoms batch created', { callId, count: symptoms.length });
  }

  /**
   * Enregistre tous les drapeaux rouges en batch
   */
  async createRedFlagsBatch(callId: string, redFlags: DetectedRedFlag[]): Promise<void> {
    if (redFlags.length === 0) {
      return;
    }

    await prisma.redFlag.createMany({
      data: redFlags.map((flag) => ({
        callId,
        flag: flag.flag,
        severity: flag.severity,
        detectedAt: flag.detectedAt,
      })),
    });

    logger.info('Red flags batch created', { callId, count: redFlags.length });
  }

  /**
   * Crée le rapport de triage final
   */
  async createTriageReport(callId: string, decision: TriageDecision): Promise<TriageReport> {
    const session = await this.getSessionFromCall(callId);

    if (!session) {
      throw new Error(`Cannot create triage report: call ${callId} not found`);
    }

    const report = await prisma.triageReport.create({
      data: {
        callId,
        priorityLevel: decision.priorityLevel,
        priorityScore: Math.round(decision.confidence * 100),
        confidence: decision.confidence,
        reasoning: decision.reasoning,

        airwayStatus: session.abcdAssessment.airway.status,
        airwayDetails: session.abcdAssessment.airway.details,

        breathingStatus: session.abcdAssessment.breathing.status,
        breathingRate: session.abcdAssessment.breathing.rate,
        breathingDetails: session.abcdAssessment.breathing.details,

        circulationStatus: session.abcdAssessment.circulation.status,
        chestPain: session.abcdAssessment.circulation.chestPain,
        bleeding: session.abcdAssessment.circulation.bleeding,
        circulationDetails: session.abcdAssessment.circulation.details,

        consciousnessLevel: session.abcdAssessment.disability.consciousnessLevel,
        consciousnessDetails: session.abcdAssessment.disability.details,

        chiefComplaint: decision.chiefComplaint,
        recommendedAction: decision.recommendedAction,
        recommendationReasoning: decision.recommendationReasoning,
        recommendationConfidence: decision.confidence,

        conversationSummary: decision.conversationSummary,
        keyQuotes: decision.keyQuotes,
      },
    });

    logger.info('Triage report created', {
      callId,
      reportId: report.id,
      priority: report.priorityLevel,
    });

    return report;
  }

  /**
   * Récupère une session de triage à partir d'un appel
   * (Conversion Call -> TriageSession)
   */
  private async getSessionFromCall(callId: string): Promise<TriageSession | null> {
    const call = await this.getCallById(callId);
    if (!call) {
      return null;
    }

    return {
      callId: call.id,
      patientId: call.patientId || undefined,
      status: call.status,
      currentPriority: 'P3' as PriorityLevel,
      confidenceScore: 0,
      messages: [],
      detectedSymptoms: [],
      detectedRedFlags: [],
      abcdAssessment: {
        airway: { status: 'UNKNOWN', details: '', concernLevel: 0 },
        breathing: { status: 'UNKNOWN', details: '', concernLevel: 0 },
        circulation: { status: 'UNKNOWN', chestPain: false, details: '', concernLevel: 0 },
        disability: { consciousnessLevel: 'ALERT', details: '', concernLevel: 0 },
        overallScore: 0,
      },
      metadata: {
        agentVersion: call.agentVersion,
        modelUsed: call.modelUsed,
        startedAt: call.startedAt,
        audioRecordingUrl: call.audioRecordingUrl || undefined,
      },
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    };
  }

  /**
   * Liste tous les appels (avec pagination)
   */
  async listCalls(options: {
    status?: CallStatus;
    limit?: number;
    offset?: number;
  }): Promise<Call[]> {
    return prisma.call.findMany({
      where: options.status ? { status: options.status } : undefined,
      include: {
        patient: true,
        triageReport: true,
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
  }
}

export const callService = new CallService();
