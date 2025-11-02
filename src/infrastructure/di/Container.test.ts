import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from './Container';

// Mock all dependencies
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Container', () => {
  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = Container.getInstance();
      const instance2 = Container.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should always return the same instance', () => {
      const instances = Array.from({ length: 5 }, () => Container.getInstance());
      const firstInstance = instances[0];

      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });
    });
  });

  describe('ensureInitialized', () => {
    it('should throw error when accessing services before initialization', () => {
      const container = Container.getInstance();

      expect(() => container.getEventBus()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getCacheService()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getCallRepository()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getOperatorRepository()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getQueueRepository()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getHandoffRepository()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getUserRepository()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getTokenStore()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getAuthService()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
      expect(() => container.getUserService()).toThrow(
        'Container not initialized. Call initialize() first.'
      );
    });
  });
});
