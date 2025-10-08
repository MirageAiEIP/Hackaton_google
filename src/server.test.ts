import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { createApp } from './server';

vi.mock('@/utils/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  testDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

describe('Fastify Server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  describe('GET /', () => {
    it('should return application info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.name).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.status).toBe('running');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockResolvedValue([1]);

      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect([200, 503]).toContain(res.statusCode);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness probe', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.alive).toBe(true);
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness probe when DB is up', async () => {
      const { prisma } = await import('@/utils/prisma');
      vi.mocked(prisma.$queryRaw).mockResolvedValue([1]);

      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.ready).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
