import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '@/server';
import { FastifyInstance } from 'fastify';

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
        getAuthService: vi.fn(() => mockAuthService),
        getUserService: vi.fn(() => mockUserService),
        shutdown: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockResolvedValue(undefined),
      })),
    },
  };
});

describe('Twilio Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/v1/twilio/post-call-webhook', () => {
    it('should process post-call data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/twilio/post-call-webhook',
        payload: {
          call_sid: 'CA123456789',
          call_duration_seconds: 120,
          transcript: 'Bonjour, je me sens mal...',
          metadata: {
            priority: 'P1',
            dispatch_triggered: true,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('success', true);
    });
  });
});
