import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '@/server';
import type { FastifyInstance } from 'fastify';
import { audioMonitoringService } from '@/services/audio-monitoring.service';

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

// Mock audio monitoring service
vi.mock('@/services/audio-monitoring.service', () => ({
  audioMonitoringService: {
    getMonitorableCalls: vi.fn(),
    getStreamInfo: vi.fn(),
    registerTwilioStream: vi.fn(),
  },
}));

describe('Monitoring Routes', () => {
  let app: FastifyInstance;
  const testCallSid = 'CA1234567890abcdef';
  const testStreamSid = 'MZ1234567890abcdef';

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

  describe('GET /api/v1/monitoring/active-calls', () => {
    it('should return list of active calls', async () => {
      const mockCalls = [
        {
          callSid: testCallSid,
          streamSid: testStreamSid,
          startedAt: new Date(),
          operatorCount: 2,
          metadata: {
            from: '+33612345678',
            to: '+33687654321',
          },
        },
      ];

      vi.mocked(audioMonitoringService.getMonitorableCalls).mockReturnValue(mockCalls);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/active-calls',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.calls).toHaveLength(1);
      expect(body.calls[0].callSid).toBe(testCallSid);
      expect(body.calls[0].operatorCount).toBe(2);
      expect(audioMonitoringService.getMonitorableCalls).toHaveBeenCalled();
    });

    it('should return empty array when no active calls', async () => {
      vi.mocked(audioMonitoringService.getMonitorableCalls).mockReturnValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/active-calls',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.calls).toHaveLength(0);
    });

    it('should handle service errors', async () => {
      vi.mocked(audioMonitoringService.getMonitorableCalls).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/active-calls',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/v1/monitoring/stream-info/:callSid', () => {
    it('should return stream info for existing call', async () => {
      const mockStreamInfo = {
        callSid: testCallSid,
        streamSid: testStreamSid,
        startedAt: new Date(),
        operators: new Map([['op1', { operatorId: 'op1' }]]),
        metadata: {
          from: '+33612345678',
          to: '+33687654321',
        },
      };

      vi.mocked(audioMonitoringService.getStreamInfo).mockReturnValue(
        mockStreamInfo as ReturnType<typeof audioMonitoringService.getStreamInfo>
      );

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/stream-info/${testCallSid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.stream.callSid).toBe(testCallSid);
      expect(body.stream.streamSid).toBe(testStreamSid);
      expect(body.stream.operatorCount).toBe(1);
      expect(audioMonitoringService.getStreamInfo).toHaveBeenCalledWith(testCallSid);
    });

    it('should return 404 for non-existent stream', async () => {
      vi.mocked(audioMonitoringService.getStreamInfo).mockReturnValue(undefined);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/stream-info/${testCallSid}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Stream not found for this call');
    });

    it('should handle service errors', async () => {
      vi.mocked(audioMonitoringService.getStreamInfo).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/stream-info/${testCallSid}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/v1/monitoring/register-stream', () => {
    it('should register new stream successfully', async () => {
      vi.mocked(audioMonitoringService.registerTwilioStream).mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/register-stream',
        payload: {
          callSid: testCallSid,
          streamSid: testStreamSid,
          metadata: {
            from: '+33612345678',
            to: '+33687654321',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Stream registered successfully');
      expect(audioMonitoringService.registerTwilioStream).toHaveBeenCalledWith(
        testCallSid,
        testStreamSid,
        {
          from: '+33612345678',
          to: '+33687654321',
        }
      );
    });

    it('should register stream without metadata', async () => {
      vi.mocked(audioMonitoringService.registerTwilioStream).mockReturnValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/register-stream',
        payload: {
          callSid: testCallSid,
          streamSid: testStreamSid,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(audioMonitoringService.registerTwilioStream).toHaveBeenCalledWith(
        testCallSid,
        testStreamSid,
        undefined
      );
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/register-stream',
        payload: {
          callSid: testCallSid,
          // Missing streamSid
        },
      });

      expect(response.statusCode).toBe(400); // Zod validation error
    });

    it('should handle service errors', async () => {
      vi.mocked(audioMonitoringService.registerTwilioStream).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/register-stream',
        payload: {
          callSid: testCallSid,
          streamSid: testStreamSid,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});
