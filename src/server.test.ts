import { describe, it, expect } from 'vitest';

import app from './server';

describe('Server', () => {
  describe('GET /', () => {
    it('should return application info', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        name: string;
        version: string;
        status: string;
      };
      expect(data.name).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.status).toBe('running');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await app.request('/health');
      expect([200, 503]).toContain(res.status);

      const data = (await res.json()) as { status: string };
      expect(data.status).toBeDefined();
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness probe', async () => {
      const res = await app.request('/health/live');
      expect(res.status).toBe(200);

      const data = (await res.json()) as { alive: boolean };
      expect(data.alive).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/unknown-route');
      expect(res.status).toBe(404);

      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(false);
    });
  });
});
