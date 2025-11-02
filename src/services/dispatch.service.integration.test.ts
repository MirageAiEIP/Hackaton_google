import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DispatchService } from '@/services/dispatch.service';
import { CallService } from '@/services/call.service';
import { prisma } from '@/utils/prisma';
import { PriorityLevel, DispatchStatus } from '@prisma/client';

/**
 * Integration tests for DispatchService with REAL database
 *
 * Prerequisites:
 * - PostgreSQL database must be running
 * - DATABASE_URL must be configured in .env
 * - Run: npm run db:migrate
 *
 * Run with: npm run test:integration
 */
describe('DispatchService - Integration Tests (Real DB)', () => {
  let dispatchService: DispatchService;
  let callService: CallService;
  let createdDispatchIds: string[] = [];
  let createdCallIds: string[] = [];
  let createdPatientIds: string[] = [];

  beforeEach(() => {
    dispatchService = new DispatchService();
    callService = new CallService();
    createdDispatchIds = [];
    createdCallIds = [];
    createdPatientIds = [];
  });

  // Cleanup after each test
  afterEach(async () => {
    // Delete dispatches first (foreign key constraint)
    if (createdDispatchIds.length > 0) {
      await prisma.dispatch.deleteMany({
        where: { id: { in: createdDispatchIds } },
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

  describe('createDispatch for P0 emergency', () => {
    it('should create SMUR dispatch for P0 priority in database', async () => {
      // Create call first
      const call = await callService.createCall({
        phoneNumber: '+33711111111',
      });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      // Create P0 dispatch
      const result = await dispatchService.createDispatch({
        priority: PriorityLevel.P0,
        location: '123 rue Urgence, Paris 75001',
        symptoms: 'Cardiac arrest, patient unconscious',
        callId: call.id,
        patientPhone: '+33711111111',
        latitude: 48.8566,
        longitude: 2.3522,
      });

      createdDispatchIds.push(result.dispatch.id);

      // Verify dispatch created
      expect(result.dispatch.id).toBeDefined();
      expect(result.dispatch.dispatchId).toContain('SMUR-');
      expect(result.dispatch.priority).toBe(PriorityLevel.P0);
      expect(result.dispatch.status).toBe(DispatchStatus.PENDING);
      expect(result.dispatch.location).toBe('123 rue Urgence, Paris 75001');
      expect(result.dispatch.symptoms).toBe('Cardiac arrest, patient unconscious');
      expect(result.dispatch.latitude).toBe(48.8566);
      expect(result.dispatch.longitude).toBe(2.3522);

      // Verify in database
      const dbDispatch = await prisma.dispatch.findUnique({
        where: { id: result.dispatch.id },
        include: { call: true },
      });

      expect(dbDispatch).not.toBeNull();
      expect(dbDispatch?.priority).toBe(PriorityLevel.P0);
      expect(dbDispatch?.call.id).toBe(call.id);
    });

    it('should create call automatically if no callId provided', async () => {
      // Create dispatch without existing call
      const result = await dispatchService.createDispatch({
        priority: PriorityLevel.P0,
        location: '456 avenue Urgence, Lyon 69001',
        symptoms: 'Severe trauma',
        patientPhone: '+33722222222',
      });

      createdDispatchIds.push(result.dispatch.id);
      createdCallIds.push(result.callId);

      // Verify call was created
      expect(result.callId).toBeDefined();

      const dbCall = await prisma.call.findUnique({
        where: { id: result.callId },
      });

      expect(dbCall).not.toBeNull();
      expect(dbCall?.transcript).toContain('Dispatch SMUR');
    });
  });

  describe('createDispatch for P1 emergency', () => {
    it('should create SMUR dispatch for P1 priority in database', async () => {
      const call = await callService.createCall({
        phoneNumber: '+33733333333',
      });
      createdCallIds.push(call.id);
      createdPatientIds.push(call.patient.id);

      const result = await dispatchService.createDispatch({
        priority: PriorityLevel.P1,
        location: '789 boulevard Urgence, Marseille 13001',
        symptoms: 'Severe chest pain, difficulty breathing',
        callId: call.id,
      });

      createdDispatchIds.push(result.dispatch.id);

      expect(result.dispatch.priority).toBe(PriorityLevel.P1);
      expect(result.dispatch.status).toBe(DispatchStatus.PENDING);

      // Verify in database
      const dbDispatch = await prisma.dispatch.findUnique({
        where: { id: result.dispatch.id },
      });

      expect(dbDispatch?.priority).toBe(PriorityLevel.P1);
    });
  });

  describe('createDispatch validation', () => {
    it('should reject P2 priority (not emergency enough)', async () => {
      await expect(
        dispatchService.createDispatch({
          priority: PriorityLevel.P2,
          location: 'Test location',
          symptoms: 'Minor injury',
        })
      ).rejects.toThrow('Only P0 and P1 priorities can dispatch SMUR');
    });

    it('should reject P3 priority', async () => {
      await expect(
        dispatchService.createDispatch({
          priority: PriorityLevel.P3,
          location: 'Test location',
          symptoms: 'Non-urgent',
        })
      ).rejects.toThrow('Only P0 and P1 priorities can dispatch SMUR');
    });
  });

  describe('updateDispatchStatus', () => {
    it('should update dispatch status to DISPATCHED in database', async () => {
      // Create dispatch
      const created = await dispatchService.createDispatch({
        priority: PriorityLevel.P0,
        location: 'Test location',
        symptoms: 'Test symptoms',
      });

      createdDispatchIds.push(created.dispatch.id);
      createdCallIds.push(created.callId);

      // Update to DISPATCHED
      const dispatchedAt = new Date();
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.DISPATCHED,
        dispatchedAt,
      });

      // Verify in database
      const updated = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });

      expect(updated?.status).toBe(DispatchStatus.DISPATCHED);
      expect(updated?.dispatchedAt).not.toBeNull();
    });

    it('should update dispatch status to ON_SCENE in database', async () => {
      const created = await dispatchService.createDispatch({
        priority: PriorityLevel.P1,
        location: 'Test location',
        symptoms: 'Test',
      });

      createdDispatchIds.push(created.dispatch.id);
      createdCallIds.push(created.callId);

      // Update to ON_SCENE
      const arrivedAt = new Date();
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.ON_SCENE,
        arrivedAt,
      });

      const updated = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });

      expect(updated?.status).toBe(DispatchStatus.ON_SCENE);
      expect(updated?.arrivedAt).not.toBeNull();
    });

    it('should update dispatch status to COMPLETED in database', async () => {
      const created = await dispatchService.createDispatch({
        priority: PriorityLevel.P0,
        location: 'Test location',
        symptoms: 'Test',
      });

      createdDispatchIds.push(created.dispatch.id);
      createdCallIds.push(created.callId);

      // Update to COMPLETED
      const completedAt = new Date();
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.COMPLETED,
        completedAt,
      });

      const updated = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });

      expect(updated?.status).toBe(DispatchStatus.COMPLETED);
      expect(updated?.completedAt).not.toBeNull();
    });
  });

  describe('dispatch workflow', () => {
    it('should complete full dispatch lifecycle in database', async () => {
      // 1. Create dispatch (PENDING)
      const created = await dispatchService.createDispatch({
        priority: PriorityLevel.P0,
        location: '123 Test Street',
        symptoms: 'Emergency test',
        latitude: 48.8566,
        longitude: 2.3522,
      });

      createdDispatchIds.push(created.dispatch.id);
      createdCallIds.push(created.callId);

      expect(created.dispatch.status).toBe(DispatchStatus.PENDING);

      // 2. Update to DISPATCHED
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.DISPATCHED,
        dispatchedAt: new Date(),
      });

      let dispatch = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });
      expect(dispatch?.status).toBe(DispatchStatus.DISPATCHED);

      // 3. Update to ON_SCENE
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.ON_SCENE,
        arrivedAt: new Date(),
      });

      dispatch = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });
      expect(dispatch?.status).toBe(DispatchStatus.ON_SCENE);

      // 4. Update to COMPLETED
      await dispatchService.updateDispatchStatus({
        dispatchId: created.dispatch.id,
        status: DispatchStatus.COMPLETED,
        completedAt: new Date(),
      });

      dispatch = await prisma.dispatch.findUnique({
        where: { id: created.dispatch.id },
      });
      expect(dispatch?.status).toBe(DispatchStatus.COMPLETED);
      expect(dispatch?.completedAt).not.toBeNull();
    });
  });
});
