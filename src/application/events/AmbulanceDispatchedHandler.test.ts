import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AmbulanceDispatchedHandler, setDashboardGateway } from './AmbulanceDispatchedHandler';
import { AmbulanceDispatchedEvent } from '@/domain/ambulance/events/AmbulanceDispatched.event';
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

describe('AmbulanceDispatchedHandler', () => {
  let handler: AmbulanceDispatchedHandler;
  let mockGateway: any;

  beforeEach(() => {
    handler = new AmbulanceDispatchedHandler();

    // Create mock gateway
    mockGateway = {
      broadcastToRoom: vi.fn(),
    };

    setDashboardGateway(mockGateway as RealtimeDashboardGateway);
    vi.clearAllMocks();
  });

  describe('handle', () => {
    it('should broadcast ambulance dispatch event to map room', async () => {
      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith('map', {
        type: 'ambulance:dispatched',
        ambulanceId: 'ambulance_123',
        dispatchId: 'dispatch_456',
        currentLocation: { lat: 48.8566, lng: 2.3522 },
        destination: { lat: 48.87, lng: 2.36 },
        estimatedArrivalMinutes: 12,
        timestamp: expect.any(String),
      });
    });

    it('should broadcast to dispatch-specific room', async () => {
      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledWith('dispatch-dispatch_456', {
        type: 'ambulance:dispatched',
        ambulanceId: 'ambulance_123',
        currentLocation: { lat: 48.8566, lng: 2.3522 },
        destination: { lat: 48.87, lng: 2.36 },
        estimatedArrivalMinutes: 12,
        timestamp: expect.any(String),
      });
    });

    it('should call broadcastToRoom twice (map + dispatch room)', async () => {
      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      await handler.handle(event);

      expect(mockGateway.broadcastToRoom).toHaveBeenCalledTimes(2);
    });

    it('should warn when dashboard gateway is not available', async () => {
      const { logger } = await import('@/utils/logger');

      // Set gateway to null
      setDashboardGateway(null as any);

      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
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

      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      await handler.handle(event);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to broadcast ambulance dispatch event',
        expect.any(Error),
        expect.objectContaining({
          ambulanceId: 'ambulance_123',
          dispatchId: 'dispatch_456',
        })
      );
    });

    it('should include correct timestamp in ISO format', async () => {
      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      await handler.handle(event);

      const call = mockGateway.broadcastToRoom.mock.calls[0];
      const payload = call[1];

      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('setDashboardGateway', () => {
    it('should set the dashboard gateway', () => {
      const newGateway = {
        broadcastToRoom: vi.fn(),
      } as any;

      setDashboardGateway(newGateway);

      const event = new AmbulanceDispatchedEvent(
        'ambulance_123',
        'dispatch_456',
        { lat: 48.8566, lng: 2.3522 },
        { lat: 48.87, lng: 2.36 },
        12
      );

      handler.handle(event);

      expect(newGateway.broadcastToRoom).toHaveBeenCalled();
    });
  });
});
