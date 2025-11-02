import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AmbulanceLocationUpdatedHandler,
  setDashboardGateway,
} from './AmbulanceLocationUpdatedHandler';
import { AmbulanceLocationUpdatedEvent } from '@/domain/ambulance/events/AmbulanceLocationUpdated.event';
import { RealtimeDashboardGateway } from '@/presentation/websocket/RealtimeDashboard.gateway';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AmbulanceLocationUpdatedHandler', () => {
  let handler: AmbulanceLocationUpdatedHandler;
  let mockGateway: any;

  beforeEach(() => {
    handler = new AmbulanceLocationUpdatedHandler();

    // Create mock gateway
    mockGateway = {
      broadcastToRoom: vi.fn(),
    };

    setDashboardGateway(mockGateway as RealtimeDashboardGateway);
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should broadcast location update to map room', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith('map', {
        type: 'ambulance:location:updated',
        ambulanceId: 'ambulance_123',
        location: { lat: 48.8566, lng: 2.3522 },
        status: 'EN_ROUTE',
        heading: 45,
        speed: 60,
        dispatchId: 'dispatch_456',
        timestamp: expect.any(String),
      });
    });

    it('should broadcast to dispatch-specific room when dispatchId is provided', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith('dispatch-dispatch_456', {
        type: 'ambulance:location:updated',
        ambulanceId: 'ambulance_123',
        location: { lat: 48.8566, lng: 2.3522 },
        status: 'EN_ROUTE',
        heading: 45,
        speed: 60,
        timestamp: expect.any(String),
      });
    });

    it('should call broadcastToRoom twice when dispatchId is provided', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledTimes(2);
    });

    it('should only broadcast to map room when dispatchId is not provided', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'AVAILABLE',
        0,
        0,
        undefined
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledTimes(1);
      expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith(
        'map',
        expect.objectContaining({
          type: 'ambulance:location:updated',
          ambulanceId: 'ambulance_123',
        })
      );
    });

    it('should handle location update with optional heading and speed', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'AVAILABLE',
        undefined,
        undefined,
        undefined
      );

      await handler.handle(event);

      const call = mockGateway.broadcastToRoom.mock.calls[0];
      const payload = call[1];

      expect(payload.heading).toBeUndefined();
      expect(payload.speed).toBeUndefined();
      expect(payload.dispatchId).toBeUndefined();
    });

    it('should warn when dashboard gateway is not available', async () => {
      const { logger } = await import('@/utils/logger');

      // Set gateway to null
      setDashboardGateway(null as any);

      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      expect(logger.warn).toHaveBeenCalledWith(
        'Dashboard gateway not available, skipping broadcast'
      );
      expect(mockGateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should handle broadcast errors gracefully', async () => {
      const { logger } = await import('@/utils/logger');

      mockGateway.broadcastToRoom.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to broadcast ambulance location update',
        expect.any(Error),
        expect.objectContaining({
          ambulanceId: 'ambulance_123',
        })
      );
    });

    it('should include correct timestamp in ISO format', async () => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      await handler.handle(event);

      const call = mockGateway.broadcastToRoom.mock.calls[0];
      const payload = call[1];

      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should broadcast different statuses correctly', async () => {
      const statuses = ['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING'];

      for (const status of statuses) {
        mockGateway.broadcastToRoom.mockClear();

        const event = new AmbulanceLocationUpdatedEvent(
          'ambulance_123',
          { lat: 48.8566, lng: 2.3522 },
          status as any,
          45,
          60,
          undefined
        );

        await handler.handle(event);

        expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith(
          'map',
          expect.objectContaining({
            status,
          })
        );
      }
    });
  });

  describe('setDashboardGateway', () => {
    it('should set the dashboard gateway', () => {
      const newGateway = {
        broadcastToRoom: vi.fn(),
      } as any;

      setDashboardGateway(newGateway);

      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        45,
        60,
        'dispatch_456'
      );

      handler.handle(event);

      expect(newGateway.broadcastToRoom).toHaveBeenCalled();
    });
  });
});
