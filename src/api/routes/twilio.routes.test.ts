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
  const originalPublicApiUrl = process.env.PUBLIC_API_URL;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/v1/twilio/inbound', () => {
    it('should return TwiML for valid https:// PUBLIC_API_URL', async () => {
      process.env.PUBLIC_API_URL = 'https://example.com';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/twilio/inbound',
        payload: {
          CallSid: 'CA123456789',
          From: '+33612345678',
          To: '+33612345679',
          CallStatus: 'ringing',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.body).toContain('<Response>');
      expect(response.body).toContain('<Connect>');
      expect(response.body).toContain(
        '<Stream url="wss://example.com/ws/twilio-media?callSid=CA123456789" track="inbound_track">'
      );

      process.env.PUBLIC_API_URL = originalPublicApiUrl;
    });

    it('should return TwiML for valid http:// PUBLIC_API_URL', async () => {
      process.env.PUBLIC_API_URL = 'http://localhost:3000';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/twilio/inbound',
        payload: {
          CallSid: 'CA987654321',
          From: '+33611111111',
          To: '+33622222222',
          CallStatus: 'ringing',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.body).toContain('<Response>');
      expect(response.body).toContain(
        '<Stream url="wss://localhost:3000/ws/twilio-media?callSid=CA987654321" track="inbound_track">'
      );

      process.env.PUBLIC_API_URL = originalPublicApiUrl;
    });

    it('should return error TwiML for invalid PUBLIC_API_URL', async () => {
      process.env.PUBLIC_API_URL = 'invalid-url-without-protocol';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/twilio/inbound',
        payload: {
          CallSid: 'CA111111111',
          From: '+33633333333',
          To: '+33644444444',
          CallStatus: 'ringing',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/xml');
      expect(response.body).toContain('<Response>');
      expect(response.body).toContain('<Say language="fr-FR">');
      expect(response.body).toContain('indisponible');
      expect(response.body).toContain('<Hangup />');

      process.env.PUBLIC_API_URL = originalPublicApiUrl;
    });
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
