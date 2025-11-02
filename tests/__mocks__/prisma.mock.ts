import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

/**
 * Mock factory for Prisma Client
 * Creates a mock Prisma instance with all models mocked
 */
export const createPrismaMock = () => {
  return {
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
    operator: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    queueEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    handoff: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    dispatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    triageReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
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
    ambulance: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    ambulanceLocation: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(this)),
  } as unknown as PrismaClient;
};

/**
 * Mock data factories for common test scenarios
 */
export const mockData = {
  patient: (overrides = {}) => ({
    id: 'patient_test_123',
    phoneHash: 'abc123def456',
    age: 35,
    gender: 'M',
    address: '123 rue Test',
    city: 'Paris',
    postalCode: '75001',
    chronicConditions: [],
    allergies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  call: (overrides = {}) => ({
    id: 'call_test_123',
    patientId: 'patient_test_123',
    status: 'IN_PROGRESS',
    transcript: 'Test transcript',
    audioRecordingUrl: null,
    startedAt: new Date(),
    endedAt: null,
    duration: null,
    priority: null,
    chiefComplaint: null,
    agentVersion: '1.0.0',
    modelUsed: null,
    qualityScore: null,
    processingTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  operator: (overrides = {}) => ({
    id: 'operator_test_123',
    userId: 'user_test_123',
    status: 'AVAILABLE',
    skills: [],
    maxConcurrentCalls: 3,
    currentCallsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  queueEntry: (overrides = {}) => ({
    id: 'queue_test_123',
    callId: 'call_test_123',
    priority: 'P2',
    status: 'WAITING',
    waitTime: 0,
    estimatedWaitTime: 120,
    operatorId: null,
    claimedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  dispatch: (overrides = {}) => ({
    id: 'dispatch_test_123',
    callId: 'call_test_123',
    priority: 'P1',
    vehicleType: 'SMUR',
    status: 'DISPATCHED',
    dispatchedAt: new Date(),
    estimatedArrivalMinutes: 15,
    location: '123 rue Test, Paris',
    symptoms: 'Chest pain',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  handoff: (overrides = {}) => ({
    id: 'handoff_test_123',
    callId: 'call_test_123',
    requestedBy: 'AI_AGENT',
    reason: 'Complex case requiring human expertise',
    status: 'PENDING',
    operatorId: null,
    acceptedAt: null,
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
