import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandoffService } from './handoff.service';
import { prisma } from '@/utils/prisma';
import type { Handoff, Call } from '@prisma/client';

// Mock logger first
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Prisma - must include ALL models accessed by the service
vi.mock('@/utils/prisma', () => ({
  prisma: {
    handoff: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    call: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
    },
  },
}));

describe('HandoffService', () => {
  let handoffService: HandoffService;

  beforeEach(() => {
    handoffService = new HandoffService();
    vi.clearAllMocks();
  });

  describe('requestHandoff', () => {
    it('should create a handoff request from AI to human', async () => {
      const mockHandoff: Handoff = {
        id: 'handoff_123',
        callId: 'call_123',
        toOperatorId: 'operator_456',
        reason: 'Symptômes contradictoires, avis médical nécessaire',
        conversationId: 'conv_abc123',
        transcript: 'Full conversation transcript...',
        aiContext: {
          symptoms: ['chest_pain', 'dizziness'],
          confidence: 0.65,
        },
        patientSummary: 'Patient 45 ans, douleur thoracique + vertiges',
        status: 'REQUESTED',
        requestedAt: new Date(),
        acceptedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.handoff.create).mockResolvedValue(mockHandoff);

      const result = await handoffService.requestHandoff({
        callId: 'call_123',
        toOperatorId: 'operator_456',
        reason: 'Symptômes contradictoires, avis médical nécessaire',
        conversationId: 'conv_abc123',
        transcript: 'Full conversation transcript...',
        aiContext: {
          symptoms: ['chest_pain', 'dizziness'],
          confidence: 0.65,
        },
        patientSummary: 'Patient 45 ans, douleur thoracique + vertiges',
      });

      expect(result).toEqual(mockHandoff);
      expect(result.status).toBe('REQUESTED');
      expect(prisma.handoff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: 'call_123',
          toOperatorId: 'operator_456',
          status: 'REQUESTED',
        }),
        include: { call: true },
      });
    });

    it('should create handoff without conversationId', async () => {
      const mockHandoff: Handoff = {
        id: 'handoff_456',
        callId: 'call_456',
        toOperatorId: 'operator_789',
        reason: 'Patient très anxieux, besoin humain',
        conversationId: null,
        transcript: 'Transcript...',
        aiContext: { anxiety_level: 'high' },
        patientSummary: 'Patient anxieux',
        status: 'REQUESTED',
        requestedAt: new Date(),
        acceptedAt: null,
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.handoff.create).mockResolvedValue(mockHandoff);

      const result = await handoffService.requestHandoff({
        callId: 'call_456',
        toOperatorId: 'operator_789',
        reason: 'Patient très anxieux, besoin humain',
        transcript: 'Transcript...',
        aiContext: { anxiety_level: 'high' },
        patientSummary: 'Patient anxieux',
      });

      expect(result.conversationId).toBeNull();
      expect(result.status).toBe('REQUESTED');
    });
  });

  describe('acceptHandoff', () => {
    it('should accept a handoff request', async () => {
      const mockHandoff: Handoff = {
        id: 'handoff_123',
        callId: 'call_123',
        toOperatorId: 'operator_456',
        reason: 'Handoff reason',
        conversationId: 'conv_abc',
        transcript: 'Transcript',
        aiContext: {},
        patientSummary: 'Summary',
        status: 'ACCEPTED',
        requestedAt: new Date(),
        acceptedAt: new Date(),
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCall: Call = {
        id: 'call_123',
        patientId: 'patient_123',
        status: 'ESCALATED',
        startedAt: new Date(),
        endedAt: null,
        duration: null,
        transcript: null,
        audioRecordingUrl: null,
        qualityScore: null,
        callSource: 'PHONE',
        operatorId: 'operator_456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.handoff.findUnique).mockResolvedValue({
        ...mockHandoff,
        status: 'REQUESTED',
        acceptedAt: null,
      });
      vi.mocked(prisma.handoff.update).mockResolvedValue(mockHandoff);
      vi.mocked(prisma.call.update).mockResolvedValue(mockCall);

      const result = await handoffService.acceptHandoff('handoff_123');

      expect(result.status).toBe('ACCEPTED');
      expect(result.acceptedAt).toBeDefined();
      expect(prisma.handoff.update).toHaveBeenCalledWith({
        where: { id: 'handoff_123' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
        },
        include: { call: true },
      });
    });

    it('should throw error if handoff not found', async () => {
      vi.mocked(prisma.handoff.findUnique).mockResolvedValue(null);

      await expect(handoffService.acceptHandoff('nonexistent')).rejects.toThrow(
        'Handoff not found'
      );
    });

    it('should throw error if handoff already accepted', async () => {
      const mockHandoff: Handoff = {
        id: 'handoff_123',
        callId: 'call_123',
        toOperatorId: 'operator_456',
        reason: 'Reason',
        conversationId: null,
        transcript: 'Transcript',
        aiContext: {},
        patientSummary: 'Summary',
        status: 'ACCEPTED',
        requestedAt: new Date(),
        acceptedAt: new Date(),
        rejectedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.handoff.findUnique).mockResolvedValue(mockHandoff);

      await expect(handoffService.acceptHandoff('handoff_123')).rejects.toThrow(
        'Handoff already accepted'
      );
    });
  });

  describe('takeControl', () => {
    it('should allow operator to take immediate control (instant handoff)', async () => {
      const mockCall = {
        id: 'call_123',
        patientId: 'patient_123',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        endedAt: null,
        duration: null,
        transcript: 'Some transcript',
        audioRecordingUrl: null,
        qualityScore: null,
        callSource: 'PHONE',
        operatorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        elevenLabsConversation: {
          conversationId: 'conv_abc123',
        },
      };

      const mockHandoff: Handoff = {
        id: 'handoff_new',
        callId: 'call_123',
        toOperatorId: 'operator_789',
        reason: 'Prise de contrôle manuelle depuis dashboard',
        conversationId: null,
        transcript: 'Some transcript',
        aiContext: {
          takenAt: expect.any(String),
          manualTakeover: true,
        },
        patientSummary: 'Opérateur operator_789 a pris le contrôle',
        status: 'ACCEPTED',
        requestedAt: expect.any(Date),
        acceptedAt: expect.any(Date),
        rejectedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      vi.mocked(prisma.call.findUnique).mockResolvedValue(mockCall);
      vi.mocked(prisma.handoff.create).mockResolvedValue(mockHandoff as Handoff);
      vi.mocked(prisma.call.update).mockResolvedValue({
        ...mockCall,
        status: 'ESCALATED',
        operatorId: 'operator_789',
      });

      const result = await handoffService.takeControl({
        callId: 'call_123',
        operatorId: 'operator_789',
      });

      expect(result.handoff.status).toBe('ACCEPTED');
      expect(result.handoff.toOperatorId).toBe('operator_789');
      expect(result.conversationContext).toBeDefined();
      expect(result.conversationContext.conversationId).toBe('conv_abc123');
      expect(prisma.handoff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: 'call_123',
          toOperatorId: 'operator_789',
          status: 'ACCEPTED', // Direct acceptance, no REQUESTED phase
          acceptedAt: expect.any(Date),
        }),
      });
      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call_123' },
        data: { status: 'ESCALATED' },
      });
    });

    it('should throw error if call not found', async () => {
      vi.mocked(prisma.call.findUnique).mockResolvedValue(null);

      await expect(
        handoffService.takeControl({
          callId: 'nonexistent',
          operatorId: 'operator_123',
        })
      ).rejects.toThrow('Call not found');
    });

    it('should throw error if call already completed', async () => {
      const mockCall: Call = {
        id: 'call_123',
        patientId: 'patient_123',
        status: 'COMPLETED',
        startedAt: new Date(),
        endedAt: new Date(),
        duration: 300,
        transcript: 'Transcript',
        audioRecordingUrl: null,
        qualityScore: null,
        callSource: 'PHONE',
        operatorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.call.findUnique).mockResolvedValue(mockCall);

      await expect(
        handoffService.takeControl({
          callId: 'call_123',
          operatorId: 'operator_123',
        })
      ).rejects.toThrow('Call already completed');
    });

    it('should include custom reason if provided', async () => {
      const mockCall: Call = {
        id: 'call_456',
        patientId: 'patient_456',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        endedAt: null,
        duration: null,
        transcript: 'Transcript',
        audioRecordingUrl: null,
        qualityScore: null,
        callSource: 'PHONE',
        operatorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockHandoff: Handoff = {
        id: 'handoff_custom',
        callId: 'call_456',
        toOperatorId: 'operator_999',
        reason: 'Cas complexe nécessitant expertise senior',
        conversationId: null,
        transcript: 'Transcript',
        aiContext: {
          takenAt: expect.any(String),
          manualTakeover: true,
        },
        patientSummary: 'Opérateur operator_999 a pris le contrôle',
        status: 'ACCEPTED',
        requestedAt: expect.any(Date),
        acceptedAt: expect.any(Date),
        rejectedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      vi.mocked(prisma.call.findUnique).mockResolvedValue(mockCall);
      vi.mocked(prisma.handoff.create).mockResolvedValue(mockHandoff as Handoff);
      vi.mocked(prisma.call.update).mockResolvedValue({
        ...mockCall,
        status: 'ESCALATED',
        operatorId: 'operator_999',
      });

      const result = await handoffService.takeControl({
        callId: 'call_456',
        operatorId: 'operator_999',
        reason: 'Cas complexe nécessitant expertise senior',
      });

      expect(result.handoff.reason).toBe('Cas complexe nécessitant expertise senior');
    });
  });
});
