import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CallService } from '@/services/call.service';
import { prisma } from '@/utils/prisma';
import { CallStatus } from '@prisma/client';

/**
 * Integration tests for CallService with REAL database
 *
 * Prerequisites:
 * - PostgreSQL database must be running
 * - DATABASE_URL must be configured in .env
 * - Run: npm run db:migrate
 *
 * Run with: npm run test:integration
 */
describe('CallService - Integration Tests (Real DB)', () => {
  let callService: CallService;
  let createdCallIds: string[] = [];
  let createdPatientIds: string[] = [];

  beforeEach(() => {
    callService = new CallService();
    createdCallIds = [];
    createdPatientIds = [];
  });

  // Cleanup after each test
  afterEach(async () => {
    // Delete test calls
    if (createdCallIds.length > 0) {
      await prisma.call.deleteMany({
        where: { id: { in: createdCallIds } },
      });
    }

    // Delete test patients
    if (createdPatientIds.length > 0) {
      await prisma.patient.deleteMany({
        where: { id: { in: createdPatientIds } },
      });
    }
  });

  describe('createCall with new patient', () => {
    it('should create a call with a new patient in database', async () => {
      const phoneNumber = '+33612345678';

      const result = await callService.createCall({
        phoneNumber,
        initialMessage: 'Patient reports chest pain',
      });

      // Track for cleanup
      createdCallIds.push(result.id);
      createdPatientIds.push(result.patient.id);

      // Verify call created
      expect(result.id).toBeDefined();
      expect(result.status).toBe(CallStatus.IN_PROGRESS);
      expect(result.patient).toBeDefined();
      expect(result.patient.phoneHash).toBeDefined();
      expect(result.patient.phoneHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256

      // Verify in database
      const dbCall = await prisma.call.findUnique({
        where: { id: result.id },
        include: { patient: true },
      });

      expect(dbCall).not.toBeNull();
      expect(dbCall?.patient.phoneHash).toBe(result.patient.phoneHash);
      expect(dbCall?.status).toBe(CallStatus.IN_PROGRESS);
    });

    it('should create multiple calls for same patient (same phone)', async () => {
      const phoneNumber = '+33698765432';

      // Create first call
      const call1 = await callService.createCall({ phoneNumber });
      createdCallIds.push(call1.id);
      createdPatientIds.push(call1.patient.id);

      // Create second call with same phone
      const call2 = await callService.createCall({ phoneNumber });
      createdCallIds.push(call2.id);

      // Should reuse same patient
      expect(call1.patient.id).toBe(call2.patient.id);
      expect(call1.id).not.toBe(call2.id); // Different calls

      // Verify in database
      const calls = await prisma.call.findMany({
        where: { patientId: call1.patient.id },
      });

      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getCallById', () => {
    it('should retrieve call with all relations from database', async () => {
      // Create test call
      const created = await callService.createCall({
        phoneNumber: '+33611223344',
      });
      createdCallIds.push(created.id);
      createdPatientIds.push(created.patient.id);

      // Retrieve it
      const result = await callService.getCallById(created.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
      expect(result?.patient).toBeDefined();
      expect(result?.status).toBe(CallStatus.IN_PROGRESS);
    });

    it('should return null for non-existent call', async () => {
      const result = await callService.getCallById('call_non_existent_123');
      expect(result).toBeNull();
    });
  });

  describe('updateCallStatus', () => {
    it('should update call status to COMPLETED in database', async () => {
      // Create test call
      const created = await callService.createCall({
        phoneNumber: '+33655443322',
      });
      createdCallIds.push(created.id);
      createdPatientIds.push(created.patient.id);

      // Update to COMPLETED
      await callService.updateCallStatus(created.id, CallStatus.COMPLETED, {
        duration: 300,
        qualityScore: 0.95,
      });

      // Verify in database
      const updated = await prisma.call.findUnique({
        where: { id: created.id },
      });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe(CallStatus.COMPLETED);
      expect(updated?.endedAt).not.toBeNull();
      expect(updated?.duration).toBe(300);
      expect(updated?.qualityScore).toBe(0.95);
    });

    it('should update call status to FAILED in database', async () => {
      const created = await callService.createCall({
        phoneNumber: '+33677889900',
      });
      createdCallIds.push(created.id);
      createdPatientIds.push(created.patient.id);

      await callService.updateCallStatus(created.id, CallStatus.FAILED);

      const updated = await prisma.call.findUnique({
        where: { id: created.id },
      });

      expect(updated?.status).toBe(CallStatus.FAILED);
      expect(updated?.endedAt).not.toBeNull();
    });
  });

  describe('appendTranscript', () => {
    it('should append transcript lines to database', async () => {
      const created = await callService.createCall({
        phoneNumber: '+33644556677',
      });
      createdCallIds.push(created.id);
      createdPatientIds.push(created.patient.id);

      // Append first line
      await callService.appendTranscript(created.id, 'Agent: Bonjour, que puis-je faire pour vous?');

      // Append second line
      await callService.appendTranscript(created.id, 'Patient: J\'ai mal à la poitrine');

      // Verify in database
      const updated = await prisma.call.findUnique({
        where: { id: created.id },
      });

      expect(updated?.transcript).toContain('Agent: Bonjour');
      expect(updated?.transcript).toContain('Patient: J\'ai mal à la poitrine');
    });
  });

  describe('listCalls', () => {
    it('should list calls with pagination from database', async () => {
      // Create 3 test calls
      const call1 = await callService.createCall({ phoneNumber: '+33601010101' });
      const call2 = await callService.createCall({ phoneNumber: '+33602020202' });
      const call3 = await callService.createCall({ phoneNumber: '+33603030303' });

      createdCallIds.push(call1.id, call2.id, call3.id);
      createdPatientIds.push(call1.patient.id, call2.patient.id, call3.patient.id);

      // List with limit
      const result = await callService.listCalls({ limit: 2 });

      expect(result.length).toBe(2);
      expect(result[0].patient).toBeDefined();
    });

    it('should filter calls by status', async () => {
      // Create one IN_PROGRESS call
      const inProgressCall = await callService.createCall({ phoneNumber: '+33604040404' });
      createdCallIds.push(inProgressCall.id);
      createdPatientIds.push(inProgressCall.patient.id);

      // Create and complete another call
      const completedCall = await callService.createCall({ phoneNumber: '+33605050505' });
      createdCallIds.push(completedCall.id);
      createdPatientIds.push(completedCall.patient.id);
      await callService.updateCallStatus(completedCall.id, CallStatus.COMPLETED);

      // Filter by COMPLETED
      const result = await callService.listCalls({ status: CallStatus.COMPLETED });

      const ourCompletedCall = result.find((c) => c.id === completedCall.id);
      expect(ourCompletedCall).toBeDefined();
      expect(ourCompletedCall?.status).toBe(CallStatus.COMPLETED);
    });
  });

  describe('deleteCall', () => {
    it('should delete call from database', async () => {
      const created = await callService.createCall({
        phoneNumber: '+33606060606',
      });
      createdPatientIds.push(created.patient.id); // Only track patient for cleanup

      // Delete the call
      await callService.deleteCall(created.id);

      // Verify deleted
      const deleted = await prisma.call.findUnique({
        where: { id: created.id },
      });

      expect(deleted).toBeNull();
    });
  });
});
