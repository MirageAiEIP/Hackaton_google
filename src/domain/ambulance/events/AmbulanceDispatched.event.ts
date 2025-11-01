import { DomainEvent } from '@/domain/shared/DomainEvent';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export class AmbulanceDispatchedEvent extends DomainEvent {
  constructor(
    public readonly ambulanceId: string,
    public readonly dispatchId: string,
    public readonly currentLocation: LocationCoordinates,
    public readonly destination: LocationCoordinates,
    public readonly estimatedArrivalMinutes: number
  ) {
    super('ambulance.dispatched');
  }

  getPayload() {
    return {
      ambulanceId: this.ambulanceId,
      dispatchId: this.dispatchId,
      currentLocation: this.currentLocation,
      destination: this.destination,
      estimatedArrivalMinutes: this.estimatedArrivalMinutes,
      timestamp: this.occurredAt.toISOString(),
    };
  }
}
