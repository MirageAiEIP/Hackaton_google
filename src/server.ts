import fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';

import { config } from '@/config';
import { logger } from '@/utils/logger';
import { testDatabaseConnection, prisma } from '@/utils/prisma';
import { Container } from '@/infrastructure/di/Container';
import { getCorsConfig } from '@/config/cors.config';
import { RealtimeDashboardGateway } from '@/presentation/websocket/RealtimeDashboard.gateway';
import { twilioRoutes } from '@/api/routes/twilio.routes';
import { twilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';
import { callsRoutes } from '@/api/routes/calls.routes';
import { operatorsRoutes } from '@/api/routes/operators.routes';
import { queueRoutes } from '@/api/routes/queue.routes';
import { toolsRoutes } from '@/api/routes/tools.routes';
import { handoffRoutes } from '@/api/routes/handoff.routes';
import { authRoutes } from '@/api/routes/auth.routes';
import { usersRoutes } from '@/api/routes/users.routes';
import fastifyStatic from '@fastify/static';
import path from 'path';

let dashboardGateway: RealtimeDashboardGateway | null = null;

const app = fastify({
  logger: false,
});

async function setupServer() {
  await app.register(sensible);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
  });

  // Support for application/x-www-form-urlencoded (Twilio webhooks)
  await app.register(formbody);

  // Cookie support for refresh tokens
  await app.register(cookie);

  await app.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    }),
  });

  // Register CORS with environment-specific configuration
  const corsConfig = getCorsConfig(config.env);
  await app.register(cors, corsConfig);

  // Register WebSocket support
  await app.register(websocket);

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
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'User Management', description: 'User management (Admin only)' },
        { name: 'twilio', description: 'Twilio webhook endpoints for phone calls' },
        { name: 'calls', description: 'Emergency call management' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  // Serve static files (frontend de test)
  // MUST be registered after Swagger but before routes
  const publicPath = path.join(process.cwd(), 'public');
  logger.info('📁 Serving static files', { publicPath, prefix: '/test/' });

  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/test/',
    decorateReply: false,
  });

  // Root route - Application info
  app.get('/', async () => {
    return {
      name: config.agent.name,
      version: config.agent.version,
      status: 'running',
      environment: config.env,
    };
  });

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

  // Register authentication routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Register user management routes
  await app.register(usersRoutes, { prefix: '/api/v1/users' });

  // Register Twilio webhook routes for ElevenLabs + Twilio integration
  await app.register(twilioRoutes, { prefix: '/api/v1/twilio' });

  // Register calls routes (web conversations)
  await app.register(callsRoutes, { prefix: '/api/v1/calls' });

  // Register operators routes (operator management)
  await app.register(operatorsRoutes, { prefix: '/api/v1/operators' });

  // Register queue routes (dashboard queue management)
  await app.register(queueRoutes, { prefix: '/api/v1/queue' });

  // Register ElevenLabs Client Tools routes (webhooks)
  await app.register(toolsRoutes, { prefix: '/api/v1/tools' });

  // Register handoff routes (AI to human handoff management)
  await app.register(handoffRoutes, { prefix: '/api/v1/handoff' });

  // WebSocket stats endpoint
  app.get('/api/v1/dashboard/stats', async () => {
    if (!dashboardGateway) {
      return { error: 'Dashboard gateway not initialized' };
    }
    return dashboardGateway.getStats();
  });

  // Register Swagger UI AFTER all routes are registered
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

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

    // Initialize DI Container (Repositories, Handlers, Controllers)
    logger.info('Initializing DI Container...');
    const container = Container.getInstance();
    await container.initialize();
    logger.info('DI Container initialized successfully');

    await setupServer();

    // Initialize Real-Time Dashboard WebSocket Gateway
    logger.info('Initializing Real-Time Dashboard Gateway...');
    dashboardGateway = new RealtimeDashboardGateway(app);
    await dashboardGateway.initialize();
    logger.info('Real-Time Dashboard Gateway initialized successfully');

    // Register Twilio Media Stream WebSocket proxy
    logger.info('Registering Twilio-ElevenLabs WebSocket proxy...');
    app.get('/ws/twilio-media', { websocket: true }, (socket, request) => {
      twilioElevenLabsProxyService.handleTwilioConnection(socket, request);
    });
    logger.info('Twilio-ElevenLabs WebSocket proxy registered at /ws/twilio-media');

    // Register Web Conversation WebSocket proxy
    logger.info('Registering Web Conversation WebSocket proxy...');
    app.get('/ws/web-conversation', { websocket: true }, (socket, request) => {
      twilioElevenLabsProxyService.handleWebConnection(socket, request);
    });
    logger.info('Web Conversation WebSocket proxy registered at /ws/web-conversation');

    // Register Operator WebSocket for handoffs
    logger.info('Registering Operator WebSocket...');
    app.get('/ws/operator', { websocket: true }, (socket, request) => {
      twilioElevenLabsProxyService.handleOperatorConnection(socket, request);
    });
    logger.info('Operator WebSocket registered at /ws/operator');

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

  // Shutdown WebSocket gateway
  if (dashboardGateway) {
    await dashboardGateway.shutdown();
  }

  const container = Container.getInstance();
  await container.shutdown();
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');

  // Shutdown WebSocket gateway
  if (dashboardGateway) {
    await dashboardGateway.shutdown();
  }

  const container = Container.getInstance();
  await container.shutdown();
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
