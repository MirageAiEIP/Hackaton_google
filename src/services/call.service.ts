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
import { Container } from '@/infrastructure/di/Container';
import { CallStartedEvent } from '@/domain/triage/events/CallStarted.event';
import { CallCompletedEvent } from '@/domain/triage/events/CallCompleted.event';
import { CallEscalatedEvent } from '@/domain/triage/events/CallEscalated.event';
import { CallCancelledEvent } from '@/domain/triage/events/CallCancelled.event';
import { queueDashboardGateway } from '@/presentation/websocket/QueueDashboard.gateway';

export class CallService {
  private hashPhoneNumber(phoneNumber: string): string {
    return crypto.createHash('sha256').update(phoneNumber).digest('hex');
  }

  /**
   * Finds an existing patient by phone hash or creates a new patient record
   * Phone numbers are hashed using SHA-256 for GDPR/HDS compliance
   *
   * @param payload - Call creation payload containing phoneNumber and optional patient info
   * @returns Promise resolving to the found or created Patient record
   *
   * @example
   * const patient = await callService.findOrCreatePatient({
   *   phoneNumber: '+33612345678',
   *   patientInfo: { age: 45, gender: 'M', city: 'Paris' }
   * });
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
   * Creates a new emergency call record with IN_PROGRESS status
   * Publishes CallStartedEvent for real-time dashboard updates
   *
   * @param payload - Call creation payload with phoneNumber, optional initial message and audio URL
   * @returns Promise resolving to the created Call record with patient relation
   * @throws {Error} If database operation fails
   *
   * @example
   * const call = await callService.createCall({
   *   phoneNumber: '+33612345678',
   *   initialMessage: 'Patient reports chest pain',
   *   audioUrl: 'https://storage.googleapis.com/...'
   * });
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

    // Publish CallStartedEvent for real-time dashboard
    const container = Container.getInstance();
    const eventBus = container.getEventBus();
    const phoneHash = this.hashPhoneNumber(payload.phoneNumber);
    await eventBus.publish(new CallStartedEvent(call.id, phoneHash));

    return call;
  }

  /**
   * Retrieves a call by ID with all related data
   * Includes: patient, triageReport, symptoms, and redFlags
   *
   * @param callId - The unique call identifier
   * @returns Promise resolving to the Call record or null if not found
   *
   * @example
   * const call = await callService.getCallById('clx1234567890');
   * if (call) {
   *   console.log(`Call status: ${call.status}, Priority: ${call.triageReport?.priorityLevel}`);
   * }
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
   * Updates the call transcript by appending a new message
   * Existing transcript is preserved and new message is appended with double newline separator
   *
   * @param callId - The unique call identifier
   * @param newMessage - The message text to append to the transcript
   * @throws {Error} If call is not found
   *
   * @example
   * await callService.updateTranscript('clx123', 'Agent: Quelle est votre urgence?');
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
   * Updates call status and publishes lifecycle events
   * Automatically sets endedAt timestamp for terminal statuses (COMPLETED, ESCALATED, CANCELLED)
   * Publishes CallCompletedEvent, CallEscalatedEvent, or CallCancelledEvent to event bus
   *
   * @param callId - The unique call identifier
   * @param status - New call status (IN_PROGRESS, COMPLETED, ESCALATED, CANCELLED, etc.)
   * @param metadata - Optional metadata (duration, qualityScore, processingTime)
   * @throws {Error} If call is not found
   *
   * @example
   * await callService.updateCallStatus('clx123', 'COMPLETED', {
   *   duration: 120,
   *   qualityScore: 0.95
   * });
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

    // Get call with patient for phoneHash
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { patient: true },
    });

    if (!call) {
      throw new Error(`Call not found: ${callId}`);
    }

    await prisma.call.update({
      where: { id: callId },
      data: updateData,
    });

    logger.info('Call status updated', { callId, status });

    // Publish lifecycle events for real-time dashboard
    const container = Container.getInstance();
    const eventBus = container.getEventBus();
    const phoneHash = call.patient?.phoneHash || 'unknown';

    if (status === 'COMPLETED') {
      await eventBus.publish(new CallCompletedEvent(callId, metadata?.duration || null, phoneHash));
    } else if (status === 'ESCALATED') {
      await eventBus.publish(new CallEscalatedEvent(callId, phoneHash, 'Escalation requested'));
    } else if (status === 'CANCELLED') {
      await eventBus.publish(new CallCancelledEvent(callId, phoneHash, 'Call cancelled'));
    }
  }

  /**
   * Appends a single line to the call transcript and broadcasts to WebSocket clients
   * Used for real-time transcript streaming to the dashboard
   *
   * @param callId - The unique call identifier
   * @param line - The transcript line to append (typically a single utterance)
   *
   * @example
   * await callService.appendTranscript('clx123', 'Patient: J\'ai mal à la poitrine');
   */
  async appendTranscript(callId: string, line: string): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { transcript: true },
    });

    if (!call) {
      logger.warn('Call not found for transcript append', { callId });
      return;
    }

    const currentTranscript = call.transcript || '';
    const newTranscript = currentTranscript ? `${currentTranscript}\n${line}` : line;

    await prisma.call.update({
      where: { id: callId },
      data: { transcript: newTranscript },
    });

    // Broadcast transcript update to subscribed WebSocket clients
    queueDashboardGateway.broadcastTranscriptUpdate(callId, newTranscript);

    logger.debug('Transcript appended', { callId, line });
  }

  /**
   * Creates a single symptom record for a call
   *
   * @param callId - The unique call identifier
   * @param symptom - Detected symptom with name, severity, onset, evolution, and confidence
   * @returns Promise resolving to the created Symptom record
   *
   * @example
   * await callService.createSymptom('clx123', {
   *   name: 'Chest pain',
   *   severity: 'SEVERE',
   *   onset: 'sudden',
   *   evolution: 'worsening',
   *   confidence: 0.92,
   *   detectedAt: new Date()
   * });
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
   * Creates a single red flag record for a call
   * Red flags indicate critical medical conditions requiring immediate attention
   *
   * @param callId - The unique call identifier
   * @param redFlag - Detected red flag with flag name, severity, and detection time
   * @returns Promise resolving to the created RedFlag record
   *
   * @example
   * await callService.createRedFlag('clx123', {
   *   flag: 'Unconscious',
   *   severity: 'CRITICAL',
   *   detectedAt: new Date()
   * });
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
   * Creates multiple symptom records in a single database operation
   * More efficient than creating symptoms individually
   *
   * @param callId - The unique call identifier
   * @param symptoms - Array of detected symptoms
   *
   * @example
   * await callService.createSymptomsBatch('clx123', [
   *   { name: 'Chest pain', severity: 'SEVERE', ... },
   *   { name: 'Shortness of breath', severity: 'MODERATE', ... }
   * ]);
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
   * Creates multiple red flag records in a single database operation
   * More efficient than creating red flags individually
   *
   * @param callId - The unique call identifier
   * @param redFlags - Array of detected red flags
   *
   * @example
   * await callService.createRedFlagsBatch('clx123', [
   *   { flag: 'Unconscious', severity: 'CRITICAL', detectedAt: new Date() },
   *   { flag: 'Severe bleeding', severity: 'CRITICAL', detectedAt: new Date() }
   * ]);
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
   * Creates a complete triage report with ABCD assessment and priority classification
   * Combines AI-generated triage decision with ABCD (Airway, Breathing, Circulation, Disability) assessment
   *
   * @param callId - The unique call identifier
   * @param decision - AI triage decision with priorityLevel, confidence, reasoning, and recommendations
   * @returns Promise resolving to the created TriageReport record
   * @throws {Error} If call is not found
   *
   * @example
   * const report = await callService.createTriageReport('clx123', {
   *   priorityLevel: 'P1',
   *   confidence: 0.95,
   *   reasoning: 'Severe chest pain with radiation to left arm',
   *   chiefComplaint: 'Chest pain',
   *   recommendedAction: 'DISPATCH_SMUR',
   *   recommendationReasoning: 'Suspected myocardial infarction',
   *   conversationSummary: '...',
   *   keyQuotes: ['Patient: "I can\'t breathe properly"']
   * });
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
   * Lists calls with optional filtering by status and pagination
   * Results are ordered by creation date (most recent first)
   *
   * @param options - Query options
   * @param options.status - Optional filter by call status
   * @param options.limit - Maximum number of results (default: 50)
   * @param options.offset - Number of results to skip for pagination (default: 0)
   * @returns Promise resolving to array of Call records with patient and triageReport
   *
   * @example
   * const activeCalls = await callService.listCalls({
   *   status: 'IN_PROGRESS',
   *   limit: 20,
   *   offset: 0
   * });
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

  /**
   * Retrieves all active calls (IN_PROGRESS or ESCALATED status)
   * Includes full relations: patient, triageReport, elevenLabsConversation, and latest handoff
   *
   * @returns Promise resolving to array of active Call records with all relations
   * @throws {Error} If database query fails
   *
   * @example
   * const activeCalls = await callService.getActiveCalls();
   * console.log(`${activeCalls.length} calls currently active`);
   */
  async getActiveCalls() {
    logger.info('Getting active calls');

    try {
      const activeCalls = await prisma.call.findMany({
        where: {
          status: {
            in: ['IN_PROGRESS', 'ESCALATED'],
          },
        },
        include: {
          patient: true,
          triageReport: true,
          elevenLabsConversation: true,
          handoffs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      });

      logger.info('Active calls retrieved', { count: activeCalls.length });

      return activeCalls;
    } catch (error) {
      logger.error('Failed to get active calls', error as Error);
      throw new Error('Failed to get active calls');
    }
  }

  /**
   * Retrieves recent calls for a specific patient within a time window
   * Used by the get_patient_history ElevenLabs tool to provide context to the AI agent
   *
   * @param patientId - The unique patient identifier
   * @param hoursAgo - Number of hours to look back (default: 24)
   * @param excludeCallId - Optional call ID to exclude from results (typically the current call)
   * @returns Promise resolving to array of recent call summaries (max 5 results)
   * @throws {Error} If database query fails
   *
   * @example
   * const history = await callService.getRecentCallsByPatient('patient123', 48, 'currentCall');
   * console.log(`Patient had ${history.length} calls in the last 48 hours`);
   */
  async getRecentCallsByPatient(
    patientId: string,
    hoursAgo: number = 24,
    excludeCallId?: string
  ): Promise<
    Array<{
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      chiefComplaint: string | null;
      priority: string | null;
      status: string;
    }>
  > {
    logger.info('Getting recent calls for patient', { patientId, hoursAgo, excludeCallId });

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

      const recentCalls = await prisma.call.findMany({
        where: {
          patientId,
          startedAt: {
            gte: cutoffDate,
          },
          ...(excludeCallId ? { id: { not: excludeCallId } } : {}),
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          chiefComplaint: true,
          priority: true,
          status: true,
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: 5, // Limit to 5 most recent calls
      });

      logger.info('Recent calls retrieved for patient', {
        patientId,
        count: recentCalls.length,
      });

      return recentCalls;
    } catch (error) {
      logger.error('Failed to get recent calls for patient', error as Error, { patientId });
      throw new Error('Failed to get recent calls for patient');
    }
  }

  /**
   * Updates patient information fields
   * Used to enrich patient records during calls as information is collected
   *
   * @param patientId - The unique patient identifier
   * @param fields - Object containing field names and values to update
   * @throws {Error} If patient is not found or database update fails
   *
   * @example
   * await callService.updatePatientInfo('patient123', {
   *   age: 45,
   *   chronicConditions: ['diabetes', 'hypertension'],
   *   allergies: ['penicillin']
   * });
   */
  async updatePatientInfo(patientId: string, fields: Record<string, unknown>): Promise<void> {
    logger.info('Updating patient info', { patientId, fields: Object.keys(fields) });

    try {
      await prisma.patient.update({
        where: { id: patientId },
        data: fields,
      });

      logger.info('Patient info updated successfully', { patientId });
    } catch (error) {
      logger.error('Failed to update patient info', error as Error, { patientId });
      throw new Error('Failed to update patient info');
    }
  }

  /**
   * Updates specific call fields dynamically
   * Useful for updating metadata fields without full status transitions
   *
   * @param callId - The unique call identifier
   * @param fields - Object containing field names and values to update
   * @throws {Error} If call is not found or database update fails
   *
   * @example
   * await callService.updateCallFields('clx123', {
   *   chiefComplaint: 'Chest pain',
   *   priority: 'P1',
   *   agentVersion: '2.0.0'
   * });
   */
  async updateCallFields(callId: string, fields: Record<string, unknown>): Promise<void> {
    logger.info('Updating call fields', { callId, fields: Object.keys(fields) });

    try {
      await prisma.call.update({
        where: { id: callId },
        data: fields,
      });

      logger.info('Call fields updated successfully', { callId });
    } catch (error) {
      logger.error('Failed to update call fields', error as Error, { callId });
      throw new Error('Failed to update call fields');
    }
  }

  /**
   * Permanently deletes a call and all related data
   * Cascade deletes: symptoms, redFlags, triageReport, handoffs, and other relations
   * WARNING: This operation is irreversible
   *
   * @param callId - The unique call identifier
   * @throws {Error} If call is not found or database deletion fails
   *
   * @example
   * await callService.deleteCall('clx123');
   */
  async deleteCall(callId: string): Promise<void> {
    logger.info('Deleting call', { callId });

    try {
      // Prisma cascade delete handles related entities (symptoms, redFlags, triageReport, etc.)
      await prisma.call.delete({
        where: { id: callId },
      });

      logger.info('Call deleted successfully', { callId });
    } catch (error) {
      logger.error('Failed to delete call', error as Error, { callId });
      throw new Error(`Failed to delete call: ${(error as Error).message}`);
    }
  }
}

export const callService = new CallService();
