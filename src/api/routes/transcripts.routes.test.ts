import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createApp } from '@/server';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/utils/prisma';

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

describe.skip('Transcripts Routes', () => {
  let app: FastifyInstance;
  let testCallId: string;

  beforeAll(async () => {
    app = await createApp();

    // Create a test call with transcript for testing
    const testCall = await prisma.call.create({
      data: {
        status: 'COMPLETED',
        transcript: "Agent: Bonjour, SAMU à votre écoute.\nPatient: J'ai mal à la poitrine.",
        startedAt: new Date(),
        endedAt: new Date(),
        duration: 300,
        patient: {
          create: {
            phoneHash: 'test_hash_' + Date.now(),
            age: 45,
            gender: 'male',
          },
        },
      },
    });

    testCallId = testCall.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCallId) {
      await prisma.call.delete({
        where: { id: testCallId },
      });
    }
    await app.close();
  });

  describe('GET /api/v1/transcripts/:callId', () => {
    it('should return transcript for existing call', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/transcripts/${testCallId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.callId).toBe(testCallId);
      expect(json.data.basicTranscript).toContain('Agent:');
      expect(json.data.basicTranscript).toContain('Patient:');
    });

    it('should return 404 for non-existent call', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transcripts/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Call not found');
    });
  });

  describe('GET /api/v1/transcripts/:callId/formatted', () => {
    it('should return formatted transcript with speaker labels', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/transcripts/${testCallId}/formatted`,
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.callId).toBe(testCallId);
      expect(json.data.messages).toBeInstanceOf(Array);
      expect(json.data.messages.length).toBeGreaterThan(0);

      // Check message structure
      const firstMessage = json.data.messages[0];
      expect(firstMessage).toHaveProperty('index');
      expect(firstMessage).toHaveProperty('speaker');
      expect(firstMessage).toHaveProperty('text');
      expect(firstMessage.speaker).toBe('agent');
    });
  });

  describe('GET /api/v1/transcripts/:callId/stats', () => {
    it('should return transcript statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/transcripts/${testCallId}/stats`,
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('callId');
      expect(json.data).toHaveProperty('hasTranscript');
      expect(json.data).toHaveProperty('wordCount');
      expect(json.data).toHaveProperty('lineCount');
      expect(json.data).toHaveProperty('characterCount');
      expect(json.data.hasTranscript).toBe(true);
      expect(json.data.wordCount).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/transcripts/bulk', () => {
    it('should return transcripts for multiple calls', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcripts/bulk',
        payload: {
          callIds: [testCallId],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data).toBeInstanceOf(Array);
      expect(json.count).toBe(1);
      expect(json.data[0].callId).toBe(testCallId);
      expect(json.data[0].hasTranscript).toBe(true);
    });

    it('should validate callIds array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transcripts/bulk',
        payload: {
          callIds: [],
        },
      });

      expect(response.statusCode).toBe(500); // Zod validation error
    });
  });

  describe('GET /api/v1/transcripts/search', () => {
    it('should search transcripts by keyword', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transcripts/search?keyword=poitrine',
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data).toBeInstanceOf(Array);
      expect(json.keyword).toBe('poitrine');

      if (json.data.length > 0) {
        expect(json.data[0]).toHaveProperty('callId');
        expect(json.data[0]).toHaveProperty('transcriptExcerpt');
      }
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transcripts/search?keyword=SAMU&limit=10&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
    });

    it('should require keyword parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transcripts/search',
      });

      // Should fail validation (missing keyword)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
