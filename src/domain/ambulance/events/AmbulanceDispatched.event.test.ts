import { describe, it, expect } from 'vitest';
import { AmbulanceDispatchedEvent } from './AmbulanceDispatched.event';

describe('AmbulanceDispatchedEvent', () => {
  it('should create event with all properties', () => {
    const currentLocation = { lat: 48.8566, lng: 2.3522 };
    const destination = { lat: 48.87, lng: 2.36 };
    const estimatedArrivalMinutes = 12;

    const event = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      currentLocation,
      destination,
      estimatedArrivalMinutes
    );

    expect(event.ambulanceId).toBe('ambulance_123');
    expect(event.dispatchId).toBe('dispatch_456');
    expect(event.currentLocation).toEqual(currentLocation);
    expect(event.destination).toEqual(destination);
    expect(event.estimatedArrivalMinutes).toBe(12);
    expect(event.eventName).toBe('AmbulanceDispatchedEvent');
  });

  it('should generate unique event id', () => {
    const event1 = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.87, lng: 2.36 },
      12
    );

    const event2 = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.87, lng: 2.36 },
      12
    );

    expect(event1.id).not.toBe(event2.id);
  });

  it('should set occurredAt timestamp', () => {
    const before = new Date();
    const event = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.87, lng: 2.36 },
      12
    );
    const after = new Date();

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should store location coordinates correctly', () => {
    const event = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.87, lng: 2.36 },
      12
    );

    expect(event.currentLocation.lat).toBe(48.8566);
    expect(event.currentLocation.lng).toBe(2.3522);
    expect(event.destination.lat).toBe(48.87);
    expect(event.destination.lng).toBe(2.36);
  });

  it('should handle zero ETA', () => {
    const event = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8566, lng: 2.3522 }, // Same location
      0
    );

    expect(event.estimatedArrivalMinutes).toBe(0);
  });

  it('should handle large ETA values', () => {
    const event = new AmbulanceDispatchedEvent(
      'ambulance_123',
      'dispatch_456',
      { lat: 48.8566, lng: 2.3522 },
      { lat: 43.6047, lng: 1.4442 }, // Paris to Toulouse
      480 // 8 hours
    );

    expect(event.estimatedArrivalMinutes).toBe(480);
  });
});
