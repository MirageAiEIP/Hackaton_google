import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeGetPatientHistory } from './get-patient-history.tool';
import { Container } from '@/infrastructure/di/Container';
import type { ICallRepository } from '@/domain/triage/repositories/ICallRepository';

// Mock Container
vi.mock('@/infrastructure/di/Container', () => ({
  Container: {
    getInstance: vi.fn(),
  },
}));

describe('Get Patient History Tool', () => {
  let mockCallRepository: ICallRepository;

  beforeEach(() => {
    mockCallRepository = {
      findById: vi.fn(),
      findByPhoneHash: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    };

    vi.mocked(Container.getInstance).mockReturnValue({
      getCallRepository: () => mockCallRepository,
    } as any);
  });

  describe('successful history retrieval', () => {
    it('should return patient history with multiple calls', async () => {
      const previousCalls = [
        {
          id: 'call-1',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-10'),
          duration: 300,
          triageReport: {
            priorityLevel: 'P3',
            chiefComplaint: 'Headache',
            recommendedAction: 'GP_REFERRAL',
          },
          patient: null,
        },
        {
          id: 'call-2',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-15'),
          duration: 600,
          triageReport: {
            priorityLevel: 'P2',
            chiefComplaint: 'Chest pain',
            recommendedAction: 'URGENT_CARE',
          },
          patient: null,
        },
      ];

      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue(previousCalls);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.success).toBe(true);
      expect(result.hasHistory).toBe(true);
      expect(result.data.callCount).toBe(2);
      expect(result.data.calls).toHaveLength(2);
      expect(result.data.calls[0]).toMatchObject({
        id: 'call-1',
        priority: 'P3',
        chiefComplaint: 'Headache',
      });
      expect(mockCallRepository.findByPhoneHash).toHaveBeenCalledWith('hash123');
    });

    it('should format call history with dates', async () => {
      const previousCalls = [
        {
          id: 'call-1',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-10T14:30:00'),
          duration: 300,
          triageReport: {
            priorityLevel: 'P3',
            chiefComplaint: 'Fever',
            recommendedAction: 'GP_REFERRAL',
          },
          patient: null,
        },
      ];

      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue(previousCalls);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.data.calls[0]?.date).toBeDefined();
      expect(result.data.calls[0]?.date).toBeInstanceOf(Date);
    });

    it('should include call duration and triage status', async () => {
      const previousCalls = [
        {
          id: 'call-1',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date(),
          duration: 180,
          triageReport: {
            priorityLevel: 'P1',
            chiefComplaint: 'Severe bleeding',
            recommendedAction: 'IMMEDIATE_DISPATCH',
          },
          patient: null,
        },
      ];

      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue(previousCalls);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.data.calls[0]).toMatchObject({
        duration: 180,
        status: 'COMPLETED',
        priority: 'P1',
      });
    });
  });

  describe('no history found', () => {
    it('should return not found when no previous calls exist', async () => {
      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue([]);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.success).toBe(true);
      expect(result.hasHistory).toBe(false);
      expect(result.data.callCount).toBe(0);
      expect(result.data.calls).toEqual([]);
      expect(result.message).toContain('No previous calls');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(mockCallRepository.findByPhoneHash).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to retrieve patient history');
    });

    it('should handle invalid phone hash', async () => {
      vi.mocked(mockCallRepository.findByPhoneHash).mockRejectedValue(
        new Error('Invalid phone hash format')
      );

      const result = await executeGetPatientHistory({ phoneHash: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('data filtering', () => {
    it('should only include relevant fields in history', async () => {
      const previousCalls = [
        {
          id: 'call-1',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date(),
          duration: 240,
          triageReport: {
            priorityLevel: 'P2',
            chiefComplaint: 'Cough',
            recommendedAction: 'GP_REFERRAL',
          },
          // Extra fields that should not be exposed
          internalNotes: 'Internal notes',
          operatorId: 'op-123',
          patient: null,
        },
      ];

      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue(previousCalls);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      const historyItem = result.data.calls[0];
      expect(historyItem).toBeDefined();
      expect(historyItem).not.toHaveProperty('internalNotes');
      expect(historyItem).not.toHaveProperty('operatorId');
      expect(historyItem).toHaveProperty('id');
      expect(historyItem).toHaveProperty('priority');
      expect(historyItem).toHaveProperty('chiefComplaint');
    });
  });

  describe('sorting', () => {
    it('should return calls with proper structure', async () => {
      const previousCalls = [
        {
          id: 'call-old',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01'),
          duration: 300,
          triageReport: {
            priorityLevel: 'P3',
            chiefComplaint: 'Old symptom',
            recommendedAction: 'GP_REFERRAL',
          },
          patient: null,
        },
        {
          id: 'call-recent',
          phoneHash: 'hash123',
          status: 'COMPLETED',
          startedAt: new Date('2025-01-15'),
          duration: 400,
          triageReport: {
            priorityLevel: 'P2',
            chiefComplaint: 'Recent symptom',
            recommendedAction: 'URGENT_CARE',
          },
          patient: null,
        },
      ];

      vi.mocked(mockCallRepository.findByPhoneHash).mockResolvedValue(previousCalls);

      const result = await executeGetPatientHistory({ phoneHash: 'hash123' });

      expect(result.data.calls).toHaveLength(2);
      expect(result.data.calls[0]?.id).toBeDefined();
      expect(result.data.calls[1]?.id).toBeDefined();
    });
  });
});
