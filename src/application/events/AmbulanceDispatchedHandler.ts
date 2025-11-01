import { IEventHandler } from '@/domain/shared/IEventBus';
import { AmbulanceDispatchedEvent } from '@/domain/ambulance/events/AmbulanceDispatched.event';
import { logger } from '@/utils/logger';
import { RealtimeDashboardGateway } from '@/presentation/websocket/RealtimeDashboard.gateway';

// Note: Dashboard gateway will be set by server.ts after initialization
let dashboardGateway: RealtimeDashboardGateway | null = null;

export function setDashboardGateway(gateway: RealtimeDashboardGateway) {
  dashboardGateway = gateway;
}

export class AmbulanceDispatchedHandler implements IEventHandler<AmbulanceDispatchedEvent> {
  constructor() {}

  async handle(event: AmbulanceDispatchedEvent): Promise<void> {
    logger.info('Handling AmbulanceDispatched event', {
      ambulanceId: event.ambulanceId,
      dispatchId: event.dispatchId,
      eta: event.estimatedArrivalMinutes,
    });

    try {
      // Broadcast to all map viewers if dashboard gateway is available
      if (dashboardGateway) {
        dashboardGateway.broadcastToRoom('map', {
          type: 'ambulance:dispatched',
          ambulanceId: event.ambulanceId,
          dispatchId: event.dispatchId,
          currentLocation: event.currentLocation,
          destination: event.destination,
          estimatedArrivalMinutes: event.estimatedArrivalMinutes,
          timestamp: event.occurredAt.toISOString(),
        });

        // Broadcast to dispatch-specific room
        dashboardGateway.broadcastToRoom(`dispatch-${event.dispatchId}`, {
          type: 'ambulance:dispatched',
          ambulanceId: event.ambulanceId,
          currentLocation: event.currentLocation,
          destination: event.destination,
          estimatedArrivalMinutes: event.estimatedArrivalMinutes,
          timestamp: event.occurredAt.toISOString(),
        });

        logger.info('Ambulance dispatch event broadcasted', {
          ambulanceId: event.ambulanceId,
          dispatchId: event.dispatchId,
        });
      } else {
        logger.warn('Dashboard gateway not available, skipping broadcast');
      }
    } catch (error) {
      logger.error('Failed to broadcast ambulance dispatch event', error as Error, {
        ambulanceId: event.ambulanceId,
        dispatchId: event.dispatchId,
      });
    }
  }
}
