import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueService } from '@/services/queue.service';
import { CallService } from '@/services/call.service';
import { prisma } from '@/utils/prisma';
import { PriorityLevel, QueueStatus } from '@prisma/client';

/**
 * Integration tests for QueueService with REAL database
 *
 * Prerequisites:
 * - PostgreSQL database must be running
 * - DATABASE_URL must be configured in .env
 * - Run: npm run db:migrate
 *
 * Run with: npm run test:integration
 */
describe('QueueService - Integration Tests (Real DB)', () => {
  let queueService: QueueService;
  let callService: CallService;
  let createdQueueIds: string[] = [];
  let createdCallIds: string[] = [];
  let createdPatientIds: string[] = [];

  beforeEach(() => {
    queueService = new QueueService();
    callService = new CallService();
    createdQueueIds = [];
    createdCallIds = [];
    createdPatientIds = [];
  });

  // Cleanup after each test
  afterEach(async () => {
    // Delete queue entries first (foreign key constraint)
    if (createdQueueIds.length > 0) {
      await prisma.queueEntry.deleteMany({
        where: { id: { in: createdQueueIds } },
      });
    }

    // Then delete calls
    if (createdCallIds.length > 0) {
      await prisma.call.deleteMany({
        where: { id: { in: createdCallIds } },
      });
    }

    // Finally delete patients
    if (createdPatientIds.length > 0) {
      await prisma.patient.deleteMany({
        where: { id: { in: createdPatientIds } },
      });
    }
  });

  describe('addToQueue', () => {
    it('should add call to queue with priority in database', async () => {
      // Create a call first
      const call = await callService.createCall({
        phoneNumber: '+33701020304',
      });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      // Add to queue
      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P2,
        chiefComplaint: 'Chest pain',
        aiSummary: 'Patient reports moderate chest pain',
        aiRecommendation: 'Requires medical evaluation',
        keySymptoms: ['chest pain', 'shortness of breath'],
        redFlags: [],
      });

      createdQueueIds.push(queueEntry.id);

      // Verify created
      expect(queueEntry.id).toBeDefined();
      expect(queueEntry.callId).toBe(call.id);
      expect(queueEntry.priority).toBe(PriorityLevel.P2);
      expect(queueEntry.status).toBe(QueueStatus.WAITING);
      expect(queueEntry.chiefComplaint).toBe('Chest pain');

      // Verify in database
      const dbEntry = await prisma.queueEntry.findUnique({
        where: { id: queueEntry.id },
        include: { call: { include: { patient: true } } },
      });

      expect(dbEntry).not.toBeNull();
      expect(dbEntry?.priority).toBe(PriorityLevel.P2);
      expect(dbEntry?.call.id).toBe(call.id);
    });

    it('should add multiple calls to queue with different priorities', async () => {
      // Create P2 call
      const call1 = await callService.createCall({ phoneNumber: '+33702020304' });
      createdCallIds.push(call1.id);
      createdPatientIds.push(call1.patient.id);

      const queue1 = await queueService.addToQueue({
        callId: call1.id,
        priority: PriorityLevel.P2,
        chiefComplaint: 'P2 emergency',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queue1.id);

      // Create P3 call
      const call2 = await callService.createCall({ phoneNumber: '+33703030304' });
      createdCallIds.push(call2.id);
      createdPatientIds.push(call2.patient.id);

      const queue2 = await queueService.addToQueue({
        callId: call2.id,
        priority: PriorityLevel.P3,
        chiefComplaint: 'P3 non-urgent',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queue2.id);

      // Verify both exist
      const allEntries = await prisma.queueEntry.findMany({
        where: { id: { in: [queue1.id, queue2.id] } },
      });

      expect(allEntries.length).toBe(2);
    });
  });

  describe('listQueue', () => {
    it('should list all queue entries from database', async () => {
      // Create test call and queue entry
      const call = await callService.createCall({ phoneNumber: '+33704040404' });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P3,
        chiefComplaint: 'Test',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queueEntry.id);

      // List queue
      const result = await queueService.listQueue();

      // Should include our entry
      const ourEntry = result.find((e) => e.id === queueEntry.id);
      expect(ourEntry).toBeDefined();
      expect(ourEntry?.call).toBeDefined();
      expect(ourEntry?.call.patient).toBeDefined();
    });

    it('should filter queue by status', async () => {
      const call = await callService.createCall({ phoneNumber: '+33705050505' });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P2,
        chiefComplaint: 'Test',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queueEntry.id);

      // Filter by WAITING
      const result = await queueService.listQueue({ status: QueueStatus.WAITING });

      // All results should be WAITING
      result.forEach((entry) => {
        expect(entry.status).toBe(QueueStatus.WAITING);
      });
    });

    it('should filter queue by priority', async () => {
      const call = await callService.createCall({ phoneNumber: '+33706060606' });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P1,
        chiefComplaint: 'Urgent',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queueEntry.id);

      // Filter by P1
      const result = await queueService.listQueue({ priority: PriorityLevel.P1 });

      // All results should be P1
      result.forEach((entry) => {
        expect(entry.priority).toBe(PriorityLevel.P1);
      });
    });
  });

  describe('claimQueueEntry', () => {
    it('should claim a WAITING queue entry in database', async () => {
      // Create call and queue entry
      const call = await callService.createCall({ phoneNumber: '+33707070707' });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P2,
        chiefComplaint: 'Test',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queueEntry.id);

      // Create operator for testing
      const operator = await prisma.operator.create({
        data: {
          name: 'Test Operator',
          email: 'test-operator-queue@example.com',
          status: 'AVAILABLE',
        },
      });

      try {
        // Claim the entry
        const claimed = await queueService.claimQueueEntry({
          queueEntryId: queueEntry.id,
          operatorId: operator.id,
        });

        expect(claimed.status).toBe(QueueStatus.CLAIMED);
        expect(claimed.claimedBy).toBe(operator.id);
        expect(claimed.claimedAt).not.toBeNull();

        // Verify in database
        const dbEntry = await prisma.queueEntry.findUnique({
          where: { id: queueEntry.id },
        });

        expect(dbEntry?.status).toBe(QueueStatus.CLAIMED);
        expect(dbEntry?.claimedBy).toBe(operator.id);
      } finally {
        // Cleanup operator
        await prisma.operator.delete({ where: { id: operator.id } });
      }
    });

    it('should throw error when claiming already claimed entry', async () => {
      // Create call and queue entry
      const call = await callService.createCall({ phoneNumber: '+33708080808' });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const queueEntry = await queueService.addToQueue({
        callId: call.id,
        priority: PriorityLevel.P3,
        chiefComplaint: 'Test',
        aiSummary: 'Test',
        aiRecommendation: 'Test',
      });
      createdQueueIds.push(queueEntry.id);

      // Create operator
      const operator = await prisma.operator.create({
        data: {
          name: 'Test Operator 2',
          email: 'test-operator-queue2@example.com',
          status: 'AVAILABLE',
        },
      });

      try {
        // Claim it first time
        await queueService.claimQueueEntry({
          queueEntryId: queueEntry.id,
          operatorId: operator.id,
        });

        // Try to claim again - should fail
        await expect(
          queueService.claimQueueEntry({
            queueEntryId: queueEntry.id,
            operatorId: operator.id,
          })
        ).rejects.toThrow();
      } finally {
        // Cleanup operator
        await prisma.operator.delete({ where: { id: operator.id } });
      }
    });
  });
});
