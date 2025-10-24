import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '@/server';
import type { FastifyInstance } from 'fastify';
import { queueService } from '@/services/queue.service';

// Mock Google Cloud Secret Manager
vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn(() => ({
    accessSecretVersion: vi.fn(),
    getSecret: vi.fn(),
    createSecret: vi.fn(),
    addSecretVersion: vi.fn(),
  })),
}));

// Mock the Container
vi.mock('@/infrastructure/di/Container', () => {
  const mockEventBus = {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
  };

  const mockAuthService = {
    login: vi.fn(),
    register: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    logoutAllDevices: vi.fn(),
  };

  const mockUserService = {
    getUserById: vi.fn(),
    listUsers: vi.fn(),
    updateUser: vi.fn(),
    deactivateUser: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
  };

  return {
    Container: {
      getInstance: vi.fn(() => ({
        getEventBus: vi.fn(() => mockEventBus),
        getAuthService: vi.fn(() => mockAuthService),
        getUserService: vi.fn(() => mockUserService),
        shutdown: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockResolvedValue(undefined),
      })),
    },
  };
});

// Mock queue service
vi.mock('@/services/queue.service', () => ({
  queueService: {
    listQueue: vi.fn(),
    getQueueStats: vi.fn(),
    claimQueueEntry: vi.fn(),
    updateQueueStatus: vi.fn(),
    getQueueEntryById: vi.fn(),
  },
}));

describe('Queue Routes', () => {
  let app: FastifyInstance;
  const testCallId = 'test-call-123';
  const testOperatorId = 'clrtest1234567890abcdef'; // Valid CUID format
  const testQueueEntryId = 'test-queue-entry-123';

  const mockQueueEntry = {
    id: testQueueEntryId,
    callId: testCallId,
    priority: 'P2',
    chiefComplaint: 'Douleur abdominale',
    patientAge: 45,
    patientGender: 'M',
    location: '12 rue de la Paix, 75001 Paris',
    aiSummary: 'Patient de 45 ans avec douleur abdominale depuis 2h',
    aiRecommendation: 'Évaluation médicale nécessaire',
    keySymptoms: ['Douleur abdominale', 'Nausées'],
    redFlags: [],
    status: 'WAITING',
    waitingSince: new Date(),
    claimedBy: null,
    claimedAt: null,
  };

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/queue', () => {
    it('should list all queue entries', async () => {
      vi.mocked(queueService.listQueue).mockResolvedValue([mockQueueEntry]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(testQueueEntryId);
      expect(body.data[0].priority).toBe('P2');
      expect(body.data[0].status).toBe('WAITING');
      expect(queueService.listQueue).toHaveBeenCalledWith({});
    });

    it('should filter queue entries by status', async () => {
      vi.mocked(queueService.listQueue).mockResolvedValue([mockQueueEntry]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue?status=WAITING',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(queueService.listQueue).toHaveBeenCalledWith({ status: 'WAITING' });
    });

    it('should filter queue entries by priority', async () => {
      vi.mocked(queueService.listQueue).mockResolvedValue([mockQueueEntry]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue?priority=P2',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].priority).toBe('P2');
      expect(queueService.listQueue).toHaveBeenCalledWith({ priority: 'P2' });
    });

    it('should return empty array when no entries match filter', async () => {
      vi.mocked(queueService.listQueue).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue?priority=P0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(queueService.listQueue).toHaveBeenCalledWith({ priority: 'P0' });
    });
  });

  describe('GET /api/v1/queue/stats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        total: 5,
        byStatus: {
          waiting: 2,
          claimed: 1,
          inProgress: 1,
          completed: 1,
          abandoned: 0,
        },
        avgWaitTimeSeconds: 120,
      };

      vi.mocked(queueService.getQueueStats).mockResolvedValue(mockStats);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('byStatus');
      expect(body.data).toHaveProperty('avgWaitTimeSeconds');
      expect(body.data.total).toBe(5);
      expect(body.data.byStatus.waiting).toBe(2);
      expect(queueService.getQueueStats).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/queue/:queueEntryId/claim', () => {
    it('should claim a queue entry successfully', async () => {
      const claimedEntry = {
        ...mockQueueEntry,
        status: 'CLAIMED',
        claimedBy: testOperatorId,
        claimedAt: new Date(),
      };

      vi.mocked(queueService.claimQueueEntry).mockResolvedValue(claimedEntry);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/queue/${testQueueEntryId}/claim`,
        payload: {
          operatorId: testOperatorId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CLAIMED');
      expect(body.data.claimedBy).toBe(testOperatorId);
      expect(body.data.claimedAt).toBeDefined();
      expect(queueService.claimQueueEntry).toHaveBeenCalledWith({
        queueEntryId: testQueueEntryId,
        operatorId: testOperatorId,
      });
    });

    it('should fail to claim already claimed entry', async () => {
      vi.mocked(queueService.claimQueueEntry).mockRejectedValue(
        new Error('Queue entry already claimed')
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/queue/${testQueueEntryId}/claim`,
        payload: {
          operatorId: testOperatorId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should fail with invalid operator ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/queue/${testQueueEntryId}/claim`,
        payload: {
          operatorId: 'invalid-id',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/v1/queue/:queueEntryId/status', () => {
    it('should update queue entry status', async () => {
      const updatedEntry = {
        ...mockQueueEntry,
        status: 'IN_PROGRESS',
      };

      vi.mocked(queueService.updateQueueStatus).mockResolvedValue(updatedEntry);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/queue/${testQueueEntryId}/status`,
        payload: {
          status: 'IN_PROGRESS',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('IN_PROGRESS');
      expect(queueService.updateQueueStatus).toHaveBeenCalledWith(testQueueEntryId, 'IN_PROGRESS');
    });

    it('should fail with invalid status', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/queue/${testQueueEntryId}/status`,
        payload: {
          status: 'INVALID_STATUS',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/queue/:queueEntryId', () => {
    it('should get queue entry by ID', async () => {
      vi.mocked(queueService.getQueueEntryById).mockResolvedValue(mockQueueEntry);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/queue/${testQueueEntryId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(testQueueEntryId);
      expect(body.data.callId).toBe(testCallId);
      expect(body.data.priority).toBe('P2');
      expect(body.data.chiefComplaint).toBe('Douleur abdominale');
      expect(queueService.getQueueEntryById).toHaveBeenCalledWith(testQueueEntryId);
    });

    it('should return 404 for non-existent queue entry', async () => {
      vi.mocked(queueService.getQueueEntryById).mockRejectedValue(
        new Error('Queue entry not found')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/queue/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});
