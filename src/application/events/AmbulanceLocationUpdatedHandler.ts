import { IEventHandler } from '@/domain/shared/IEventBus';
import { AmbulanceLocationUpdatedEvent } from '@/domain/ambulance/events/AmbulanceLocationUpdated.event';
import { logger } from '@/utils/logger';
import { RealtimeDashboardGateway } from '@/presentation/websocket/RealtimeDashboard.gateway';

// Note: Dashboard gateway will be set by server.ts after initialization
let dashboardGateway: RealtimeDashboardGateway | null = null;

export function setDashboardGateway(gateway: RealtimeDashboardGateway) {
  dashboardGateway = gateway;
}

export class AmbulanceLocationUpdatedHandler
  implements IEventHandler<AmbulanceLocationUpdatedEvent>
{
  constructor() {}

  async handle(event: AmbulanceLocationUpdatedEvent): Promise<void> {
    logger.info('Handling AmbulanceLocationUpdated event', {
      ambulanceId: event.ambulanceId,
      status: event.status,
      dispatchId: event.dispatchId,
    });

    try {
      // Broadcast to all map viewers if dashboard gateway is available
      if (dashboardGateway) {
        dashboardGateway.broadcastToRoom('map', {
          type: 'ambulance:location:updated',
          ambulanceId: event.ambulanceId,
          location: event.location,
          status: event.status,
          heading: event.heading,
          speed: event.speed,
          dispatchId: event.dispatchId,
          timestamp: event.occurredAt.toISOString(),
        });

        // Also broadcast to dispatch-specific room if dispatchId exists
        if (event.dispatchId) {
          dashboardGateway.broadcastToRoom(`dispatch-${event.dispatchId}`, {
            type: 'ambulance:location:updated',
            ambulanceId: event.ambulanceId,
            location: event.location,
            status: event.status,
            heading: event.heading,
            speed: event.speed,
            timestamp: event.occurredAt.toISOString(),
          });
        }

        logger.info('Ambulance location update broadcasted', {
          ambulanceId: event.ambulanceId,
          dispatchId: event.dispatchId,
        });
      } else {
        logger.warn('Dashboard gateway not available, skipping broadcast');
      }
    } catch (error) {
      logger.error('Failed to broadcast ambulance location update', error as Error, {
        ambulanceId: event.ambulanceId,
      });
    }
  }
}
