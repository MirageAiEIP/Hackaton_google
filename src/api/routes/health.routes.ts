import { Hono } from 'hono';

import { config } from '@/config';
import type { IHealthCheck } from '@/types';
import { prisma } from '@/utils/prisma';

const health = new Hono();

// Health check endpoint
health.get('/', async (c) => {
  const startTime = process.uptime();

  // Check database
  let dbStatus: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'up';
  } catch {
    dbStatus = 'down';
  }

  const healthCheck: IHealthCheck = {
    status: dbStatus === 'up' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      ai: 'up', // TODO: Add actual AI service check
    },
    uptime: Math.floor(startTime),
    version: config.agent.version,
  };

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

  return c.json(healthCheck, statusCode);
});

// Readiness probe
health.get('/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ready: true }, 200);
  } catch {
    return c.json({ ready: false }, 503);
  }
});

// Liveness probe
health.get('/live', (c) => {
  return c.json({ alive: true }, 200);
});

export default health;
