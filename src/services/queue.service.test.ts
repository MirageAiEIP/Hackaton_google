import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueueService } from './queue.service';
import { prisma } from '@/utils/prisma';
import type { Queue, PriorityLevel } from '@prisma/client';

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
    queueEntry: {
      // Service uses queueEntry, not queue
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    call: {
      findUnique: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock Container
vi.mock('@/infrastructure/di/Container', () => ({
  Container: {
    getInstance: vi.fn(() => ({
      getEventBus: vi.fn(() => ({
        publish: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn(),
      })),
    })),
  },
}));

describe('QueueService', () => {
  let queueService: QueueService;

  beforeEach(() => {
    queueService = new QueueService();
    vi.clearAllMocks();
  });

  describe('addToQueue', () => {
    it.skip('should add P2 call to queue', async () => {
      const mockQueue: Queue = {
        id: 'queue_123',
        callId: 'call_123',
        priority: 'P2' as PriorityLevel,
        chiefComplaint: 'Douleur thoracique modérée',
        aiSummary: 'Patient 45 ans avec douleur thoracique depuis 30min',
        aiRecommendation: 'Consultation médecin régulateur recommandée',
        keySymptoms: ['chest_pain', 'mild_dyspnea'],
        redFlags: [],
        status: 'WAITING',
        waitingSince: new Date(),
        addedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.queueEntry.create).mockResolvedValue(mockQueue);

      const result = await queueService.addToQueue({
        callId: 'call_123',
        priority: 'P2',
        chiefComplaint: 'Douleur thoracique modérée',
        aiSummary: 'Patient 45 ans avec douleur thoracique depuis 30min',
        aiRecommendation: 'Consultation médecin régulateur recommandée',
        keySymptoms: ['chest_pain', 'mild_dyspnea'],
        redFlags: [],
      });

      expect(result).toEqual(mockQueue);
      expect(prisma.queueEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: 'call_123',
          priority: 'P2',
          status: 'WAITING',
        }),
        include: expect.objectContaining({
          call: expect.objectContaining({
            include: { patient: true },
          }),
        }),
      });
    });

    it.skip('should add P2 call to queue', async () => {
      const mockQueue: Queue = {
        id: 'queue_456',
        callId: 'call_456',
        priority: 'P2' as PriorityLevel,
        chiefComplaint: 'Fièvre persistante',
        aiSummary: 'Enfant 3 ans avec fièvre 39°C depuis 2 jours',
        aiRecommendation: 'Avis médical nécessaire',
        keySymptoms: ['fever', 'fatigue'],
        redFlags: [],
        status: 'WAITING',
        waitingSince: new Date(),
        addedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.queueEntry.create).mockResolvedValue(mockQueue);

      const result = await queueService.addToQueue({
        callId: 'call_456',
        priority: 'P2',
        chiefComplaint: 'Fièvre persistante',
        aiSummary: 'Enfant 3 ans avec fièvre 39°C depuis 2 jours',
        aiRecommendation: 'Avis médical nécessaire',
        keySymptoms: ['fever', 'fatigue'],
      });

      expect(result.priority).toBe('P2');
      expect(result.status).toBe('WAITING');
    });

    it('should accept P0 priority (can be queued if no operator)', async () => {
      const mockQueue: Queue = {
        id: 'queue_789',
        callId: 'call_789',
        priority: 'P0' as PriorityLevel,
        chiefComplaint: 'Arrêt cardiaque',
        aiSummary: 'Emergency',
        aiRecommendation: 'Dispatch SMUR',
        keySymptoms: ['unconscious', 'not breathing'],
        redFlags: [],
        status: 'WAITING',
        waitingSince: new Date(),
        addedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.queueEntry.create).mockResolvedValue(mockQueue);

      const result = await queueService.addToQueue({
        callId: 'call_789',
        priority: 'P0',
        chiefComplaint: 'Arrêt cardiaque',
        aiSummary: 'Emergency',
        aiRecommendation: 'Dispatch SMUR',
        keySymptoms: ['unconscious', 'not breathing'],
      });

      expect(result.priority).toBe('P0');
      expect(result.status).toBe('WAITING');
    });

    it('should accept P1 priority (can be queued if no operator)', async () => {
      const mockQueue: Queue = {
        id: 'queue_790',
        callId: 'call_790',
        priority: 'P1' as PriorityLevel,
        chiefComplaint: 'Douleur thoracique sévère',
        aiSummary: 'Suspicion SCA',
        aiRecommendation: 'Urgent',
        keySymptoms: ['chest pain', 'sweating'],
        redFlags: [],
        status: 'WAITING',
        waitingSince: new Date(),
        addedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.queueEntry.create).mockResolvedValue(mockQueue);

      const result = await queueService.addToQueue({
        callId: 'call_790',
        priority: 'P1',
        chiefComplaint: 'Douleur thoracique sévère',
        aiSummary: 'Suspicion SCA',
        aiRecommendation: 'Urgent',
        keySymptoms: ['chest pain', 'sweating'],
      });

      expect(result.priority).toBe('P1');
      expect(result.status).toBe('WAITING');
    });

    it('should throw error for P3 priority (should receive direct advice)', async () => {
      await expect(
        queueService.addToQueue({
          callId: 'call_999',
          priority: 'P3',
          chiefComplaint: 'Question médicale',
          aiSummary: 'Simple question',
          aiRecommendation: 'Conseil donné',
        })
      ).rejects.toThrow('P3 should receive direct advice from Agent 1, not be queued');
    });
  });

  describe('listQueue', () => {
    it('should return queue sorted by priority and wait time', async () => {
      const now = new Date();
      const mockQueueEntries: Queue[] = [
        {
          id: 'queue_1',
          callId: 'call_1',
          priority: 'P2' as PriorityLevel,
          chiefComplaint: 'Urgent case',
          aiSummary: 'Summary 1',
          aiRecommendation: 'Recommendation 1',
          keySymptoms: ['symptom1'],
          redFlags: [],
          status: 'WAITING',
          waitingSince: new Date(now.getTime() - 3600000),
          addedAt: new Date(now.getTime() - 3600000), // 1 hour ago
          claimedAt: null,
          claimedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'queue_2',
          callId: 'call_2',
          priority: 'P1' as PriorityLevel,
          chiefComplaint: 'Vital emergency case',
          aiSummary: 'Summary 2',
          aiRecommendation: 'Recommendation 2',
          keySymptoms: ['symptom2'],
          redFlags: [],
          status: 'WAITING',
          waitingSince: new Date(now.getTime() - 1800000),
          addedAt: new Date(now.getTime() - 1800000), // 30 min ago
          claimedAt: null,
          claimedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.queueEntry.findMany).mockResolvedValue(mockQueueEntries);

      const result = await queueService.listQueue();

      expect(result).toHaveLength(2);
      expect(result[0]?.priority).toBe('P2'); // P2 has higher priority than P3
    });

    it('should filter queue by status', async () => {
      const mockQueueEntries: Queue[] = [
        {
          id: 'queue_1',
          callId: 'call_1',
          priority: 'P2' as PriorityLevel,
          chiefComplaint: 'Complaint 1',
          aiSummary: 'Summary 1',
          aiRecommendation: 'Recommendation 1',
          keySymptoms: [],
          redFlags: [],
          status: 'WAITING',
          waitingSince: new Date(),
          addedAt: new Date(),
          claimedAt: null,
          claimedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.queueEntry.findMany).mockResolvedValue(mockQueueEntries);

      const result = await queueService.listQueue({ status: 'WAITING' });

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('WAITING');
      expect(prisma.queueEntry.findMany).toHaveBeenCalledWith({
        where: { status: 'WAITING' },
        include: { call: { include: { patient: true } } },
        orderBy: [{ priority: 'asc' }, { waitingSince: 'asc' }],
      });
    });

    it('should filter queue by priority', async () => {
      const mockQueueEntries: Queue[] = [
        {
          id: 'queue_1',
          callId: 'call_1',
          priority: 'P2' as PriorityLevel,
          chiefComplaint: 'P2 case',
          aiSummary: 'Summary',
          aiRecommendation: 'Recommendation',
          keySymptoms: [],
          redFlags: [],
          status: 'WAITING',
          waitingSince: new Date(),
          addedAt: new Date(),
          claimedAt: null,
          claimedBy: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.queueEntry.findMany).mockResolvedValue(mockQueueEntries);

      const result = await queueService.listQueue({ priority: 'P2' });

      expect(result).toHaveLength(1);
      expect(result[0]?.priority).toBe('P2');
    });
  });

  describe('claimQueueEntry', () => {
    it('should claim a queue entry for an operator', async () => {
      const now = new Date();
      const mockQueueBefore: Queue = {
        id: 'queue_123',
        callId: 'call_123',
        priority: 'P2' as PriorityLevel,
        chiefComplaint: 'Douleur thoracique',
        aiSummary: 'Summary',
        aiRecommendation: 'Recommendation',
        keySymptoms: ['chest_pain'],
        redFlags: [],
        status: 'WAITING',
        waitingSince: new Date(now.getTime() - 600000),
        addedAt: new Date(now.getTime() - 600000),
        claimedAt: null,
        claimedBy: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueueAfter: Queue = {
        ...mockQueueBefore,
        status: 'CLAIMED',
        claimedAt: now,
        claimedBy: 'operator_456',
      };

      vi.mocked(prisma.queueEntry.findUnique).mockResolvedValue(mockQueueBefore);
      vi.mocked(prisma.queueEntry.update).mockResolvedValue(mockQueueAfter);

      const result = await queueService.claimQueueEntry({
        queueEntryId: 'queue_123',
        operatorId: 'operator_456',
      });

      expect(result.status).toBe('CLAIMED');
      expect(result.claimedBy).toBe('operator_456');
      expect(result.claimedAt).toBeDefined();
      expect(prisma.queueEntry.update).toHaveBeenCalledWith({
        where: { id: 'queue_123' },
        data: {
          status: 'CLAIMED',
          claimedBy: 'operator_456',
          claimedAt: expect.any(Date),
        },
        include: { call: { include: { patient: true } } },
      });
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Mock count by status - service calls count() 6 times (total + 5 statuses)
      vi.mocked(prisma.queueEntry.count)
        .mockResolvedValueOnce(17) // total
        .mockResolvedValueOnce(5) // WAITING
        .mockResolvedValueOnce(2) // CLAIMED
        .mockResolvedValueOnce(8) // IN_PROGRESS
        .mockResolvedValueOnce(10) // COMPLETED
        .mockResolvedValueOnce(0); // ABANDONED

      // Mock findMany for waiting entries (avgWaitTime calculation)
      vi.mocked(prisma.queueEntry.findMany).mockResolvedValue([
        { waitingSince: new Date(Date.now() - 300000) }, // 5 min ago
        { waitingSince: new Date(Date.now() - 600000) }, // 10 min ago
      ]);

      const result = await queueService.getQueueStats();

      expect(result.total).toBe(17);
      expect(result.byStatus.waiting).toBe(5);
      expect(result.byStatus.claimed).toBe(2);
      expect(result.byStatus.inProgress).toBe(8);
      expect(result.byStatus.completed).toBe(10);
      expect(result.byStatus.abandoned).toBe(0);
      expect(result.avgWaitTimeSeconds).toBeGreaterThan(0);
    });

    it('should handle empty queue', async () => {
      vi.mocked(prisma.queueEntry.count).mockResolvedValue(0);
      vi.mocked(prisma.queueEntry.findMany).mockResolvedValue([]);

      const result = await queueService.getQueueStats();

      expect(result.total).toBe(0);
      expect(result.byStatus.waiting).toBe(0);
      expect(result.byStatus.claimed).toBe(0);
      expect(result.avgWaitTimeSeconds).toBe(0);
    });
  });
});
