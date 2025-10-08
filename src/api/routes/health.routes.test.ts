import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

import healthRoutes from './health.routes';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe('Health Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/health', healthRoutes);
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when database is up', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockResolvedValue([1]);

      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        services: {
          database: 'up',
          ai: 'up',
        },
      });
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(data.version).toBe('1.0.0');
    });

    it('should return degraded status when database is down', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB connection failed'));

      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data).toMatchObject({
        status: 'degraded',
        services: {
          database: 'down',
          ai: 'up',
        },
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when database is accessible', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockResolvedValue([1]);

      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ ready: true });
    });

    it('should return not ready when database is inaccessible', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB error'));

      const res = await app.request('/health/ready');
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data).toEqual({ ready: false });
    });
  });

  describe('GET /health/live', () => {
    it('should always return alive', async () => {
      const res = await app.request('/health/live');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ alive: true });
    });
  });
});
