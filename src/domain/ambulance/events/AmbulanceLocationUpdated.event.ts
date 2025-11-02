import { DomainEvent } from '@/domain/shared/DomainEvent';
import { AmbulanceStatus } from '@prisma/client';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export class AmbulanceLocationUpdatedEvent extends DomainEvent {
  constructor(
    public readonly ambulanceId: string,
    public readonly location: LocationCoordinates,
    public readonly status: AmbulanceStatus,
    public readonly heading: number,
    public readonly speed: number,
    public readonly dispatchId?: string
  ) {
    super('ambulance.location.updated');
  }

  getPayload() {
    return {
      ambulanceId: this.ambulanceId,
      location: this.location,
      status: this.status,
      heading: this.heading,
      speed: this.speed,
      dispatchId: this.dispatchId,
      timestamp: this.occurredAt.toISOString(),
    };
  }
}
