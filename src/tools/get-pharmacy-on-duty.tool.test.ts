import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeGetPharmacyOnDuty } from './get-pharmacy-on-duty.tool';

// Mock external API call
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Get Pharmacy On Duty Tool', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('successful pharmacy search', () => {
    it('should find pharmacies near location', async () => {
      const result = await executeGetPharmacyOnDuty({
        postalCode: '75001',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.pharmacies).toBeDefined();
      expect(Array.isArray(result.data.pharmacies)).toBe(true);
    });

    it('should include pharmacy details', async () => {
      const result = await executeGetPharmacyOnDuty({
        city: 'Lyon',
      });

      expect(result.data.pharmacies).toBeDefined();
      if (result.data.pharmacies.length > 0) {
        const pharmacy = result.data.pharmacies[0];
        expect(pharmacy).toHaveProperty('name');
        expect(pharmacy).toHaveProperty('address');
        expect(pharmacy).toHaveProperty('phone');
        expect(pharmacy).toHaveProperty('hours');
      }
    });
  });

  describe('mock data for development', () => {
    it('should return mock pharmacies when API not available', async () => {
      const result = await executeGetPharmacyOnDuty({
        postalCode: '75001',
      });

      // In development, should return mock data
      expect(result.success).toBe(true);
      expect(result.data.pharmacies).toBeDefined();
      expect(result.data.pharmacies.length).toBeGreaterThan(0);
    });

    it('should include realistic pharmacy data structure', async () => {
      const result = await executeGetPharmacyOnDuty({
        city: 'Paris',
      });

      const pharmacy = result.data.pharmacies[0];
      expect(pharmacy).toMatchObject({
        name: expect.any(String),
        address: expect.any(String),
        phone: expect.any(String),
        hours: expect.any(String),
        distance: expect.any(String),
      });
    });
  });

  describe('location parsing', () => {
    it('should handle postal code format', async () => {
      const result = await executeGetPharmacyOnDuty({
        postalCode: '75001',
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBeGreaterThan(0);
    });

    it('should handle city name format', async () => {
      const result = await executeGetPharmacyOnDuty({
        city: 'Paris',
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBeGreaterThan(0);
    });

    it('should handle coordinates', async () => {
      const result = await executeGetPharmacyOnDuty({
        latitude: 48.8566,
        longitude: 2.3522,
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBeGreaterThan(0);
    });
  });

  describe('opening hours', () => {
    it('should include opening hours information', async () => {
      const result = await executeGetPharmacyOnDuty({
        city: 'Paris',
      });

      if (result.data.pharmacies.length > 0) {
        const pharmacy = result.data.pharmacies[0];
        expect(pharmacy).toHaveProperty('hours');
        expect(typeof pharmacy.hours).toBe('string');
      }
    });
  });

  describe('return format', () => {
    it('should return user-friendly message', async () => {
      const result = await executeGetPharmacyOnDuty({
        city: 'Paris',
      });

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.data.count).toBeGreaterThan(0);
    });

    it('should include timestamp', async () => {
      const result = await executeGetPharmacyOnDuty({
        postalCode: '75001',
      });

      expect(result.data.timestamp).toBeDefined();
      expect(typeof result.data.timestamp).toBe('string');
    });
  });

  describe('performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      await executeGetPharmacyOnDuty({
        city: 'Paris',
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should respond within 1 second (mock data)
      expect(duration).toBeLessThan(1000);
    });
  });
});
