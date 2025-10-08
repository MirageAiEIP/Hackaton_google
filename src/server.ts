import fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { testDatabaseConnection, prisma } from '@/utils/prisma';

const app = fastify({
  logger: false,
});

async function setupServer() {
  await app.register(sensible);

  await app.register(cors, {
    origin: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SAMU AI Triage API',
        description: 'AI-powered medical triage system for emergency calls',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.server.port}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'calls', description: 'Emergency call management' },
        { name: 'triage', description: 'Triage operations' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  app.get(
    '/',
    {
      schema: {
        description: 'Get application information and status',
        tags: ['health'],
        response: {
          200: {
            description: 'Application information',
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Application name' },
              version: { type: 'string', description: 'Application version' },
              status: { type: 'string', description: 'Current status' },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Current server time',
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        name: config.agent.name,
        version: config.agent.version,
        status: 'running',
        timestamp: new Date().toISOString(),
      };
    }
  );

  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Comprehensive health check',
        description: 'Returns overall system health including database and AI service status',
        response: {
          200: {
            description: 'System is healthy',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'degraded', 'unhealthy'],
                description: 'Overall system health status',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Health check timestamp',
              },
              services: {
                type: 'object',
                description: 'Status of individual services',
                properties: {
                  database: {
                    type: 'string',
                    enum: ['up', 'down'],
                    description: 'Database connection status',
                  },
                  ai: { type: 'string', enum: ['up', 'down'], description: 'AI service status' },
                },
              },
              uptime: { type: 'number', description: 'Server uptime in seconds' },
              version: { type: 'string', description: 'Application version' },
            },
          },
          503: {
            description: 'System is degraded or unhealthy',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['degraded', 'unhealthy'] },
              timestamp: { type: 'string', format: 'date-time' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['up', 'down'] },
                  ai: { type: 'string', enum: ['up', 'down'] },
                },
              },
              uptime: { type: 'number' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async (_, reply) => {
      const startTime = process.uptime();

      let dbStatus: 'up' | 'down' = 'down';
      try {
        await prisma.$queryRaw<number[]>`SELECT 1`;
        dbStatus = 'up';
      } catch {
        dbStatus = 'down';
      }

      const healthCheck = {
        status: dbStatus === 'up' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          ai: 'up' as const,
        },
        uptime: Math.floor(startTime),
        version: config.agent.version,
      };

      const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
      reply.status(statusCode as 200);
      return healthCheck;
    }
  );

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness probe',
        description: 'Kubernetes readiness probe - checks if the application can receive traffic',
        response: {
          200: {
            description: 'Application is ready to receive traffic',
            type: 'object',
            properties: {
              ready: { type: 'boolean', description: 'Readiness status' },
            },
          },
          503: {
            description: 'Application is not ready',
            type: 'object',
            properties: {
              ready: { type: 'boolean', description: 'Readiness status' },
            },
          },
        },
      },
    },
    async (_, reply) => {
      try {
        await prisma.$queryRaw<number[]>`SELECT 1`;
        return { ready: true };
      } catch {
        reply.status(503 as 200);
        return { ready: false };
      }
    }
  );

  app.get(
    '/health/live',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        description: 'Kubernetes liveness probe - checks if the application is alive',
        response: {
          200: {
            description: 'Application is alive',
            type: 'object',
            properties: {
              alive: { type: 'boolean', description: 'Liveness status' },
            },
          },
        },
      },
    },
    async () => {
      return { alive: true };
    }
  );

  app.setNotFoundHandler((_, reply) => {
    return reply.code(404).send({
      success: false,
      error: {
        code: 'HTTP_404',
        message: 'Route not found',
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    logger.error('Request error', error as Error);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: `HTTP_${statusCode}`,
        message,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  });
}

async function startServer() {
  try {
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logger.warn(
        'Failed to connect to database. Server will start anyway but health checks will fail.'
      );
    }

    await setupServer();

    const port = config.server.port;
    await app.listen({ port, host: '0.0.0.0' });

    logger.info(`Starting ${config.agent.name}...`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Log Level: ${config.logging.level}`);
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Swagger UI: http://localhost:${port}/docs`);
    logger.info(`Health check: http://localhost:${port}/health`);
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await app.close();
  process.exit(0);
});

export async function createApp() {
  await setupServer();
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export default app;
