import { describe, it, expect } from 'vitest';
import { AmbulanceLocationUpdatedEvent } from './AmbulanceLocationUpdated.event';

describe('AmbulanceLocationUpdatedEvent', () => {
  it('should create event with all properties', () => {
    const location = { lat: 48.8566, lng: 2.3522 };

    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      location,
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );

    expect(event.ambulanceId).toBe('ambulance_123');
    expect(event.location).toEqual(location);
    expect(event.status).toBe('EN_ROUTE');
    expect(event.heading).toBe(45);
    expect(event.speed).toBe(60);
    expect(event.dispatchId).toBe('dispatch_456');
    expect(event.eventName).toBe('AmbulanceLocationUpdatedEvent');
  });

  it('should create event with optional heading', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      undefined,
      60,
      'dispatch_456'
    );

    expect(event.heading).toBeUndefined();
    expect(event.speed).toBe(60);
  });

  it('should create event with optional speed', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      45,
      undefined,
      'dispatch_456'
    );

    expect(event.heading).toBe(45);
    expect(event.speed).toBeUndefined();
  });

  it('should create event with optional dispatchId', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'AVAILABLE',
      0,
      0,
      undefined
    );

    expect(event.dispatchId).toBeUndefined();
    expect(event.status).toBe('AVAILABLE');
  });

  it('should generate unique event id', () => {
    const event1 = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );

    const event2 = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );

    expect(event1.id).not.toBe(event2.id);
  });

  it('should set occurredAt timestamp', () => {
    const before = new Date();
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should handle different ambulance statuses', () => {
    const statuses = [
      'AVAILABLE',
      'DISPATCHED',
      'EN_ROUTE',
      'ON_SCENE',
      'RETURNING',
      'OUT_OF_SERVICE',
    ];

    statuses.forEach((status) => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        status as any,
        45,
        60,
        'dispatch_456'
      );

      expect(event.status).toBe(status);
    });
  });

  it('should store location coordinates correctly', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );

    expect(event.location.lat).toBe(48.8566);
    expect(event.location.lng).toBe(2.3522);
  });

  it('should handle heading values from 0 to 360', () => {
    const headings = [0, 45, 90, 135, 180, 225, 270, 315, 360];

    headings.forEach((heading) => {
      const event = new AmbulanceLocationUpdatedEvent(
        'ambulance_123',
        { lat: 48.8566, lng: 2.3522 },
        'EN_ROUTE',
        heading,
        60,
        'dispatch_456'
      );

      expect(event.heading).toBe(heading);
    });
  });

  it('should handle zero speed for stopped ambulance', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'ON_SCENE',
      180,
      0,
      'dispatch_456'
    );

    expect(event.speed).toBe(0);
    expect(event.status).toBe('ON_SCENE');
  });

  it('should handle high speed values', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { lat: 48.8566, lng: 2.3522 },
      'EN_ROUTE',
      0,
      120, // Emergency speed
      'dispatch_456'
    );

    expect(event.speed).toBe(120);
  });

  it('should return correct payload from getPayload()', () => {
    const location = { latitude: 48.8566, longitude: 2.3522 };

    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_789',
      location,
      'EN_ROUTE',
      90,
      75,
      'dispatch_999'
    );

    const payload = event.getPayload();

    expect(payload.ambulanceId).toBe('ambulance_789');
    expect(payload.location).toEqual(location);
    expect(payload.status).toBe('EN_ROUTE');
    expect(payload.heading).toBe(90);
    expect(payload.speed).toBe(75);
    expect(payload.dispatchId).toBe('dispatch_999');
    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe('string');
  });

  it('should include optional fields in payload', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { latitude: 48.87, longitude: 2.36 },
      'AVAILABLE',
      0,
      0,
      undefined
    );

    const payload = event.getPayload();

    expect(payload.heading).toBe(0);
    expect(payload.speed).toBe(0);
    expect(payload.dispatchId).toBeUndefined();
  });

  it('should include ISO timestamp in payload', () => {
    const event = new AmbulanceLocationUpdatedEvent(
      'ambulance_123',
      { latitude: 48.8566, longitude: 2.3522 },
      'EN_ROUTE',
      45,
      60,
      'dispatch_456'
    );

    const payload = event.getPayload();
    const timestamp = new Date(payload.timestamp);

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toBe(payload.timestamp);
  });
});
