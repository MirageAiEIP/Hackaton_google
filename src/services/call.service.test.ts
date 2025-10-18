import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CallService } from './call.service';
import { prisma } from '@/utils/prisma';
import type { CreateCallPayload } from '@/types/triage.types';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    call: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    symptom: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    redFlag: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    triageReport: {
      create: vi.fn(),
    },
  },
}));

describe('CallService', () => {
  let callService: CallService;

  beforeEach(() => {
    vi.clearAllMocks();
    callService = new CallService();
  });

  describe('findOrCreatePatient', () => {
    it('should create new patient if not exists', async () => {
      const payload: CreateCallPayload = {
        phoneNumber: '+33612345678',
        patientInfo: {
          age: 35,
          gender: 'M',
          city: 'Paris',
        },
      };

      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.patient.create).mockResolvedValue({
        id: 'patient-123',
        phoneHash: 'hash123',
        age: 35,
        gender: 'M',
        city: 'Paris',
        address: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        locationPrecision: null,
        allergies: [],
        medications: [],
        chronicConditions: [],
        recentSurgery: false,
        pregnancy: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const patient = await callService.findOrCreatePatient(payload);

      expect(patient.id).toBe('patient-123');
      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          age: 35,
          gender: 'M',
          city: 'Paris',
        }),
      });
    });

    it('should return existing patient if found', async () => {
      const payload: CreateCallPayload = {
        phoneNumber: '+33612345678',
      };

      const existingPatient = {
        id: 'patient-existing',
        phoneHash: 'hash123',
        age: 40,
        gender: 'F',
        city: 'Lyon',
        address: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        locationPrecision: null,
        allergies: [],
        medications: [],
        chronicConditions: [],
        recentSurgery: false,
        pregnancy: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.patient.findUnique).mockResolvedValue(existingPatient);

      const patient = await callService.findOrCreatePatient(payload);

      expect(patient.id).toBe('patient-existing');
      expect(prisma.patient.create).not.toHaveBeenCalled();
    });

    it('should hash phone number consistently', async () => {
      const payload: CreateCallPayload = {
        phoneNumber: '+33612345678',
      };

      vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.patient.create).mockResolvedValue({
        id: 'patient-123',
        phoneHash: 'hash123',
        age: null,
        gender: null,
        city: null,
        address: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        locationPrecision: null,
        allergies: [],
        medications: [],
        chronicConditions: [],
        recentSurgery: false,
        pregnancy: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await callService.findOrCreatePatient(payload);

      expect(prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { phoneHash: expect.any(String) },
      });
    });
  });

  describe.skip('createCall', () => {
    it('should create call with patient', async () => {
      const payload: CreateCallPayload = {
        phoneNumber: '+33612345678',
        initialMessage: 'Bonjour, mon mari ne respire plus',
      };

      const mockPatient = {
        id: 'patient-123',
        phoneHash: 'hash123',
        age: null,
        gender: null,
        city: null,
        address: null,
        postalCode: null,
        latitude: null,
        longitude: null,
        locationPrecision: null,
        allergies: [],
        medications: [],
        chronicConditions: [],
        recentSurgery: false,
        pregnancy: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.patient.findUnique).mockResolvedValue(mockPatient);
      vi.mocked(prisma.call.create).mockResolvedValue({
        id: 'call-123',
        patientId: 'patient-123',
        status: 'IN_PROGRESS',
        transcript: payload.initialMessage,
        audioRecordingUrl: null,
        startedAt: new Date(),
        endedAt: null,
        duration: 0,
        agentVersion: '1.0.0',
        modelUsed: 'claude-3-5-sonnet',
        processingTime: null,
        qualityScore: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: mockPatient,
      } as any);

      const call = await callService.createCall(payload);

      expect(call.id).toBe('call-123');
      expect(call.status).toBe('IN_PROGRESS');
      expect(call.transcript).toBe(payload.initialMessage);
      expect(prisma.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: 'patient-123',
          status: 'IN_PROGRESS',
          transcript: payload.initialMessage,
        }),
        include: { patient: true },
      });
    });
  });

  describe('getCallById', () => {
    it('should retrieve call with all relations', async () => {
      const mockCall = {
        id: 'call-123',
        patientId: 'patient-123',
        status: 'IN_PROGRESS',
        transcript: 'Test',
        audioRecordingUrl: null,
        startedAt: new Date(),
        endedAt: null,
        duration: 0,
        agentVersion: '1.0.0',
        modelUsed: 'claude-3-5-sonnet',
        processingTime: null,
        qualityScore: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: null,
        triageReport: null,
        symptoms: [],
        redFlags: [],
      };

      vi.mocked(prisma.call.findUnique).mockResolvedValue(mockCall as any);

      const call = await callService.getCallById('call-123');

      expect(call?.id).toBe('call-123');
      expect(prisma.call.findUnique).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        include: {
          patient: true,
          triageReport: true,
          symptoms: true,
          redFlags: true,
        },
      });
    });

    it('should return null if call not found', async () => {
      vi.mocked(prisma.call.findUnique).mockResolvedValue(null);

      const call = await callService.getCallById('non-existent');

      expect(call).toBeNull();
    });
  });

  describe('updateTranscript', () => {
    it('should append message to existing transcript', async () => {
      vi.mocked(prisma.call.findUnique).mockResolvedValue({
        transcript: 'Message 1',
      } as any);

      await callService.updateTranscript('call-123', 'Message 2');

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          transcript: 'Message 1\n\nMessage 2',
        }),
      });
    });

    it('should create transcript if empty', async () => {
      vi.mocked(prisma.call.findUnique).mockResolvedValue({
        transcript: null,
      } as any);

      await callService.updateTranscript('call-123', 'First message');

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          transcript: 'First message',
        }),
      });
    });

    it('should throw if call not found', async () => {
      vi.mocked(prisma.call.findUnique).mockResolvedValue(null);

      await expect(callService.updateTranscript('non-existent', 'Message')).rejects.toThrow(
        'Call non-existent not found'
      );
    });
  });

  describe.skip('updateCallStatus', () => {
    it('should update status and set endedAt for completed call', async () => {
      await callService.updateCallStatus('call-123', 'COMPLETED', {
        duration: 300,
        qualityScore: 0.95,
      });

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          endedAt: expect.any(Date),
          duration: 300,
          qualityScore: 0.95,
        }),
      });
    });

    it('should not set endedAt for in-progress status', async () => {
      await callService.updateCallStatus('call-123', 'IN_PROGRESS');

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.not.objectContaining({
          endedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('createSymptomsBatch', () => {
    it('should create multiple symptoms', async () => {
      const symptoms = [
        {
          name: 'Chest pain',
          severity: 'SEVERE' as const,
          onset: 'Sudden',
          evolution: 'Worsening',
          detectedAt: new Date(),
          confidence: 0.9,
          mentionedInMessages: [0, 1],
        },
        {
          name: 'Shortness of breath',
          severity: 'MODERATE' as const,
          onset: 'Gradual',
          evolution: 'Stable',
          detectedAt: new Date(),
          confidence: 0.85,
          mentionedInMessages: [1],
        },
      ];

      await callService.createSymptomsBatch('call-123', symptoms);

      expect(prisma.symptom.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'Chest pain', severity: 'SEVERE' }),
          expect.objectContaining({ name: 'Shortness of breath', severity: 'MODERATE' }),
        ]),
      });
    });

    it('should not create anything for empty array', async () => {
      await callService.createSymptomsBatch('call-123', []);

      expect(prisma.symptom.createMany).not.toHaveBeenCalled();
    });
  });

  describe('createRedFlagsBatch', () => {
    it('should create multiple red flags', async () => {
      const redFlags = [
        {
          flag: 'Cardiac arrest signs',
          severity: 'CRITICAL' as const,
          category: 'CIRCULATION' as const,
          detectedAt: new Date(),
          triggerKeywords: ['arrêt cardiaque', 'ne respire plus'],
          confidence: 0.95,
        },
      ];

      await callService.createRedFlagsBatch('call-123', redFlags);

      expect(prisma.redFlag.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            flag: 'Cardiac arrest signs',
            severity: 'CRITICAL',
          }),
        ]),
      });
    });
  });

  describe('listCalls', () => {
    it('should list calls with pagination', async () => {
      vi.mocked(prisma.call.findMany).mockResolvedValue([]);

      await callService.listCalls({ limit: 10, offset: 20 });

      expect(prisma.call.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: {
          patient: true,
          triageReport: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.call.findMany).mockResolvedValue([]);

      await callService.listCalls({ status: 'COMPLETED' });

      expect(prisma.call.findMany).toHaveBeenCalledWith({
        where: { status: 'COMPLETED' },
        include: {
          patient: true,
          triageReport: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });
});
