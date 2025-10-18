import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisCacheService } from './RedisCacheService';

describe('RedisCacheService', () => {
  let cacheService: RedisCacheService;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  beforeAll(() => {
    cacheService = new RedisCacheService(redisUrl);
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  it('should set and get a value', async () => {
    // Arrange
    const key = `test:${Date.now()}`;
    const value = { name: 'Test', count: 42 };

    // Act
    await cacheService.set(key, value);
    const result = await cacheService.get(key);

    // Assert
    expect(result).toEqual(value);

    // Cleanup
    await cacheService.delete(key);
  });

  it('should return null for non-existent key', async () => {
    // Arrange
    const key = `non-existent:${Date.now()}`;

    // Act
    const result = await cacheService.get(key);

    // Assert
    expect(result).toBeNull();
  });

  it('should set value with TTL and expire', async () => {
    // Arrange
    const key = `ttl-test:${Date.now()}`;
    const value = 'expires-soon';
    const ttl = 1; // 1 second

    // Act
    await cacheService.set(key, value, ttl);

    // Value should exist immediately
    const immediateResult = await cacheService.get(key);
    expect(immediateResult).toBe(value);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Value should be gone
    const expiredResult = await cacheService.get(key);
    expect(expiredResult).toBeNull();
  });

  it('should delete a value', async () => {
    // Arrange
    const key = `delete-test:${Date.now()}`;
    const value = 'to-be-deleted';

    // Act
    await cacheService.set(key, value);
    const beforeDelete = await cacheService.get(key);
    expect(beforeDelete).toBe(value);

    await cacheService.delete(key);
    const afterDelete = await cacheService.get(key);

    // Assert
    expect(afterDelete).toBeNull();
  });

  it('should check if key exists', async () => {
    // Arrange
    const key = `exists-test:${Date.now()}`;
    const value = 'exists';

    // Act & Assert
    expect(await cacheService.has(key)).toBe(false);

    await cacheService.set(key, value);
    expect(await cacheService.has(key)).toBe(true);

    await cacheService.delete(key);
    expect(await cacheService.has(key)).toBe(false);
  });

  it('should delete pattern', async () => {
    // Arrange
    const prefix = `pattern-test:${Date.now()}`;
    const keys = [`${prefix}:1`, `${prefix}:2`, `${prefix}:3`];

    // Set multiple keys
    for (const key of keys) {
      await cacheService.set(key, 'value');
    }

    // Verify all exist
    for (const key of keys) {
      expect(await cacheService.has(key)).toBe(true);
    }

    // Act - Delete by pattern
    await cacheService.deletePattern(`${prefix}:*`);

    // Assert - All should be deleted
    for (const key of keys) {
      expect(await cacheService.has(key)).toBe(false);
    }
  });
});
