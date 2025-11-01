import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createApp } from '@/server';
import type { FastifyInstance } from 'fastify';
import { ambulanceTrackingService } from '@/services/ambulance-tracking.service';
import { dispatchService } from '@/services/dispatch.service';
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

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock services
vi.mock('@/services/ambulance-tracking.service', () => ({
  ambulanceTrackingService: {
    getAllActiveAmbulances: vi.fn(),
  },
}));

vi.mock('@/services/dispatch.service', () => ({
  dispatchService: {
    getMapDispatches: vi.fn(),
  },
}));

vi.mock('@/utils/prisma', () => ({
  prisma: {
    hospital: {
      findMany: vi.fn(),
    },
  },
}));

describe('Map Routes', () => {
  let app: FastifyInstance;

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

  describe('GET /api/map/data', () => {
    it('should return all map data with ambulances, dispatches, and hospitals', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          callSign: 'Alpha 1',
          type: 'SMUR',
          status: 'AVAILABLE',
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          heading: 0,
          speed: 0,
          currentDispatchId: null,
          homeHospital: {
            id: 'hosp_1',
            name: 'Hospital 1',
          },
        },
      ];

      const mockDispatches = [
        {
          id: 'disp_1',
          dispatchId: 'SMUR-123',
          priority: 'P0',
          status: 'EN_ROUTE',
          latitude: 48.87,
          longitude: 2.36,
          location: '15 rue Test',
          symptoms: 'Test symptoms',
          requestedAt: new Date(),
          dispatchedAt: new Date(),
          ambulanceId: 'amb_1',
          estimatedArrivalMinutes: 10,
        },
      ];

      const mockHospitals = [
        {
          id: 'hosp_1',
          name: 'Hospital 1',
          code: 'HP-01',
          latitude: 48.8566,
          longitude: 2.3522,
          address: '123 Test St',
          city: 'Paris',
          hasSMUR: true,
          hasEmergencyRoom: true,
          hasHelicopterPad: false,
          ambulances: [
            { id: 'amb_1', status: 'AVAILABLE' },
            { id: 'amb_2', status: 'EN_ROUTE' },
          ],
        },
      ];

      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockResolvedValue(
        mockAmbulances as any
      );
      vi.mocked(dispatchService.getMapDispatches).mockResolvedValue({
        dispatches: mockDispatches,
        geoJson: { type: 'FeatureCollection', features: [] },
      } as any);
      vi.mocked(prisma.hospital.findMany).mockResolvedValue(mockHospitals as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/data',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.ambulances).toHaveLength(1);
      expect(data.ambulances[0].vehicleId).toBe('SMUR-1');
      expect(data.dispatches).toHaveLength(1);
      expect(data.dispatches[0].dispatchId).toBe('SMUR-123');
      expect(data.hospitals).toHaveLength(1);
      expect(data.hospitals[0].totalAmbulances).toBe(2);
      expect(data.hospitals[0].availableAmbulances).toBe(1);
      expect(data.timestamp).toBeDefined();
    });

    it('should use lastHours query parameter', async () => {
      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockResolvedValue([]);
      vi.mocked(dispatchService.getMapDispatches).mockResolvedValue({
        dispatches: [],
        geoJson: { type: 'FeatureCollection', features: [] },
      } as any);
      vi.mocked(prisma.hospital.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/data?lastHours=48',
      });

      expect(response.statusCode).toBe(200);
      expect(dispatchService.getMapDispatches).toHaveBeenCalledWith({
        lastHours: 48,
      });
    });

    it('should use default lastHours of 24', async () => {
      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockResolvedValue([]);
      vi.mocked(dispatchService.getMapDispatches).mockResolvedValue({
        dispatches: [],
        geoJson: { type: 'FeatureCollection', features: [] },
      } as any);
      vi.mocked(prisma.hospital.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/data',
      });

      expect(response.statusCode).toBe(200);
      expect(dispatchService.getMapDispatches).toHaveBeenCalledWith({
        lastHours: 24,
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockRejectedValue(
        new Error('Database error')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/data',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Failed to fetch map data');
    });
  });

  describe('GET /api/map/ambulances', () => {
    it('should return all active ambulances', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          callSign: 'Alpha 1',
          type: 'SMUR',
          status: 'AVAILABLE',
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          heading: 0,
          speed: 0,
          currentDispatchId: null,
          homeHospital: {
            id: 'hosp_1',
            name: 'Hospital 1',
          },
        },
        {
          id: 'amb_2',
          vehicleId: 'AMB-1',
          callSign: 'Bravo 1',
          type: 'AMBULANCE',
          status: 'EN_ROUTE',
          currentLatitude: 48.87,
          currentLongitude: 2.36,
          heading: 45,
          speed: 60,
          currentDispatchId: 'dispatch_1',
          homeHospital: {
            id: 'hosp_2',
            name: 'Hospital 2',
          },
        },
      ];

      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockResolvedValue(
        mockAmbulances as any
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/ambulances',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.ambulances).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.ambulances[0].vehicleId).toBe('SMUR-1');
      expect(data.ambulances[0].location.latitude).toBe(48.8566);
      expect(data.ambulances[1].vehicleId).toBe('AMB-1');
      expect(data.ambulances[1].status).toBe('EN_ROUTE');
    });

    it('should return empty array when no ambulances', async () => {
      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/ambulances',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.ambulances).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(ambulanceTrackingService.getAllActiveAmbulances).mockRejectedValue(
        new Error('Service error')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/ambulances',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Failed to fetch ambulances');
    });
  });

  describe('GET /api/map/dispatches', () => {
    it('should return active dispatches', async () => {
      const mockDispatches = [
        {
          id: 'disp_1',
          dispatchId: 'SMUR-123',
          priority: 'P0',
          status: 'EN_ROUTE',
          latitude: 48.87,
          longitude: 2.36,
          location: '15 rue Test',
          symptoms: 'Test symptoms',
          requestedAt: new Date('2025-01-01T10:00:00Z'),
          dispatchedAt: new Date('2025-01-01T10:02:00Z'),
          ambulanceId: 'amb_1',
          estimatedArrivalMinutes: 10,
        },
      ];

      vi.mocked(dispatchService.getMapDispatches).mockResolvedValue({
        dispatches: mockDispatches,
        geoJson: { type: 'FeatureCollection', features: [] },
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/dispatches',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.dispatches).toHaveLength(1);
      expect(data.count).toBe(1);
      expect(data.dispatches[0].dispatchId).toBe('SMUR-123');
      expect(data.dispatches[0].priority).toBe('P0');
      expect(data.dispatches[0].location.latitude).toBe(48.87);
    });

    it('should use lastHours query parameter', async () => {
      vi.mocked(dispatchService.getMapDispatches).mockResolvedValue({
        dispatches: [],
        geoJson: { type: 'FeatureCollection', features: [] },
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/dispatches?lastHours=48',
      });

      expect(response.statusCode).toBe(200);
      expect(dispatchService.getMapDispatches).toHaveBeenCalledWith({
        lastHours: 48,
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(dispatchService.getMapDispatches).mockRejectedValue(new Error('Service error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/dispatches',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Failed to fetch dispatches');
    });
  });

  describe('GET /api/map/hospitals', () => {
    it('should return all active hospitals with ambulance counts', async () => {
      const mockHospitals = [
        {
          id: 'hosp_1',
          name: 'Hospital 1',
          code: 'HP-01',
          latitude: 48.8566,
          longitude: 2.3522,
          address: '123 Test St',
          city: 'Paris',
          hasSMUR: true,
          hasEmergencyRoom: true,
          hasHelicopterPad: false,
          ambulances: [
            { id: 'amb_1', status: 'AVAILABLE' },
            { id: 'amb_2', status: 'EN_ROUTE' },
            { id: 'amb_3', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'hosp_2',
          name: 'Hospital 2',
          code: 'HP-02',
          latitude: 48.87,
          longitude: 2.36,
          address: '456 Test Ave',
          city: 'Paris',
          hasSMUR: false,
          hasEmergencyRoom: true,
          hasHelicopterPad: true,
          ambulances: [{ id: 'amb_4', status: 'ON_SCENE' }],
        },
      ];

      vi.mocked(prisma.hospital.findMany).mockResolvedValue(mockHospitals as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/hospitals',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.hospitals).toHaveLength(2);
      expect(data.count).toBe(2);

      expect(data.hospitals[0].name).toBe('Hospital 1');
      expect(data.hospitals[0].totalAmbulances).toBe(3);
      expect(data.hospitals[0].availableAmbulances).toBe(2);

      expect(data.hospitals[1].name).toBe('Hospital 2');
      expect(data.hospitals[1].totalAmbulances).toBe(1);
      expect(data.hospitals[1].availableAmbulances).toBe(0);
    });

    it('should return empty array when no hospitals', async () => {
      vi.mocked(prisma.hospital.findMany).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/hospitals',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data.hospitals).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.hospital.findMany).mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/map/hospitals',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Failed to fetch hospitals');
    });
  });
});
