import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CallService } from '@/services/call.service';
import { mockData } from '../../__mocks__/prisma.mock';

// Mock Prisma - use inline factory to avoid hoisting issues
vi.mock('@/utils/prisma', () => {
  return {
    prisma: {
      call: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      patient: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(this)),
    },
  };
});

// Import mocked prisma after vi.mock call
import { prisma } from '@/utils/prisma';

// Mock Container and EventBus
vi.mock('@/infrastructure/di/Container', () => ({
  Container: {
    getInstance: vi.fn(() => ({
      getEventBus: vi.fn(() => ({
        publish: vi.fn(),
      })),
    })),
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock QueueDashboardGateway
vi.mock('@/presentation/websocket/QueueDashboard.gateway', () => ({
  queueDashboardGateway: {
    broadcastTranscriptUpdate: vi.fn(),
  },
}));

describe('CallService - Unit Tests (Mocked)', () => {
  let callService: CallService;

  beforeEach(() => {
    callService = new CallService();
    vi.clearAllMocks();
  });

  describe('createCall', () => {
    it('should create a call with a new patient', async () => {
      const mockPatient = mockData.patient();
      const mockCall = mockData.call({ patientId: mockPatient.id });

      (prisma.patient.findUnique as any).mockResolvedValue(null);
      (prisma.patient.create as any).mockResolvedValue(mockPatient);
      (prisma.call.create as any).mockResolvedValue({ ...mockCall, patient: mockPatient });

      const result = await callService.createCall({
        phoneNumber: '+33612345678',
      });

      expect(result.id).toBe('call_test_123');
      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.patient.create).toHaveBeenCalledOnce();
      expect(prisma.call.create).toHaveBeenCalledOnce();
    });

    it('should create a call with existing patient', async () => {
      const mockPatient = mockData.patient();
      const mockCall = mockData.call({ patientId: mockPatient.id });

      (prisma.patient.findUnique as any).mockResolvedValue(mockPatient);
      (prisma.call.create as any).mockResolvedValue({ ...mockCall, patient: mockPatient });

      const result = await callService.createCall({
        phoneNumber: '+33612345678',
      });

      expect(result.id).toBe('call_test_123');
      expect(prisma.patient.create).not.toHaveBeenCalled();
      expect(prisma.call.create).toHaveBeenCalledOnce();
    });

    it('should hash phone number for privacy', async () => {
      const mockPatient = mockData.patient();
      const mockCall = mockData.call();

      (prisma.patient.findUnique as any).mockResolvedValue(null);
      (prisma.patient.create as any).mockResolvedValue(mockPatient);
      (prisma.call.create as any).mockResolvedValue({ ...mockCall, patient: mockPatient });

      await callService.createCall({
        phoneNumber: '+33612345678',
      });

      const createPatientCall = (prisma.patient.create as any).mock.calls[0][0];
      expect(createPatientCall.data.phoneHash).toBeDefined();
      expect(createPatientCall.data.phoneHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });
  });

  describe('getCallById', () => {
    it('should return call with all relations', async () => {
      const mockCall = {
        ...mockData.call(),
        patient: mockData.patient(),
        triageReport: null,
        symptoms: [],
        redFlags: [],
      };

      (prisma.call.findUnique as any).mockResolvedValue(mockCall);

      const result = await callService.getCallById('call_test_123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('call_test_123');
      expect(result?.patient).toBeDefined();
      expect(prisma.call.findUnique).toHaveBeenCalledWith({
        where: { id: 'call_test_123' },
        include: {
          patient: true,
          triageReport: true,
          symptoms: true,
          redFlags: true,
        },
      });
    });

    it('should return null if call not found', async () => {
      (prisma.call.findUnique as any).mockResolvedValue(null);

      const result = await callService.getCallById('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('updateCallStatus', () => {
    it('should update call status to COMPLETED with endedAt', async () => {
      const mockCall = {
        ...mockData.call(),
        patient: mockData.patient(),
      };

      (prisma.call.findUnique as any).mockResolvedValue(mockCall);
      (prisma.call.update as any).mockResolvedValue({
        ...mockCall,
        status: 'COMPLETED',
        endedAt: new Date(),
      });

      await callService.updateCallStatus('call_test_123', 'COMPLETED', {
        duration: 300,
        qualityScore: 0.95,
      });

      const updateCall = (prisma.call.update as any).mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
      expect(updateCall.data.endedAt).toBeDefined();
      expect(updateCall.data.duration).toBe(300);
      expect(updateCall.data.qualityScore).toBe(0.95);
    });

    it('should throw error if call not found', async () => {
      (prisma.call.findUnique as any).mockResolvedValue(null);

      await expect(
        callService.updateCallStatus('non_existent', 'COMPLETED')
      ).rejects.toThrow('Call not found');
    });

    it('should not set endedAt for IN_PROGRESS status', async () => {
      const mockCall = {
        ...mockData.call(),
        patient: mockData.patient(),
      };

      (prisma.call.findUnique as any).mockResolvedValue(mockCall);
      (prisma.call.update as any).mockResolvedValue(mockCall);

      await callService.updateCallStatus('call_test_123', 'IN_PROGRESS');

      const updateCall = (prisma.call.update as any).mock.calls[0][0];
      expect(updateCall.data.endedAt).toBeUndefined();
    });
  });

  describe('appendTranscript', () => {
    it('should append line to existing transcript', async () => {
      const mockCall = mockData.call({ transcript: 'Line 1' });

      (prisma.call.findUnique as any).mockResolvedValue(mockCall);
      (prisma.call.update as any).mockResolvedValue({
        ...mockCall,
        transcript: 'Line 1\nLine 2',
      });

      await callService.appendTranscript('call_test_123', 'Line 2');

      const updateCall = (prisma.call.update as any).mock.calls[0][0];
      expect(updateCall.data.transcript).toBe('Line 1\nLine 2');
    });

    it('should handle empty transcript gracefully', async () => {
      const mockCall = mockData.call({ transcript: null });

      (prisma.call.findUnique as any).mockResolvedValue(mockCall);
      (prisma.call.update as any).mockResolvedValue({
        ...mockCall,
        transcript: 'First line',
      });

      await callService.appendTranscript('call_test_123', 'First line');

      const updateCall = (prisma.call.update as any).mock.calls[0][0];
      expect(updateCall.data.transcript).toBe('First line');
    });

    it('should not fail if call not found', async () => {
      (prisma.call.findUnique as any).mockResolvedValue(null);

      await expect(
        callService.appendTranscript('non_existent', 'Line')
      ).resolves.not.toThrow();
    });
  });

  describe('listCalls', () => {
    it('should list calls with default pagination', async () => {
      const mockCalls = [
        { ...mockData.call({ id: 'call_1' }), patient: mockData.patient(), triageReport: null },
        { ...mockData.call({ id: 'call_2' }), patient: mockData.patient(), triageReport: null },
      ];

      (prisma.call.findMany as any).mockResolvedValue(mockCalls);

      const result = await callService.listCalls({});

      expect(result).toHaveLength(2);
      expect(prisma.call.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: { patient: true, triageReport: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter calls by status', async () => {
      const mockCalls = [
        {
          ...mockData.call({ id: 'call_1', status: 'COMPLETED' }),
          patient: mockData.patient(),
          triageReport: null,
        },
      ];

      (prisma.call.findMany as any).mockResolvedValue(mockCalls);

      const result = await callService.listCalls({ status: 'COMPLETED' });

      expect(result).toHaveLength(1);
      expect(prisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      );
    });

    it('should support custom pagination', async () => {
      (prisma.call.findMany as any).mockResolvedValue([]);

      await callService.listCalls({ limit: 10, offset: 20 });

      expect(prisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('deleteCall', () => {
    it('should delete call successfully', async () => {
      (prisma.call.delete as any).mockResolvedValue(mockData.call());

      await expect(callService.deleteCall('call_test_123')).resolves.not.toThrow();

      expect(prisma.call.delete).toHaveBeenCalledWith({
        where: { id: 'call_test_123' },
      });
    });

    it('should throw error if call not found', async () => {
      (prisma.call.delete as any).mockRejectedValue(new Error('Record to delete does not exist'));

      await expect(callService.deleteCall('non_existent')).rejects.toThrow(
        'Failed to delete call'
      );
    });
  });
});
