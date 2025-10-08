import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { errorHandler } from '@/api/middleware/error-handler';
import { requestLogger } from '@/api/middleware/request-logger';
import healthRoutes from '@/api/routes/health.routes';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { testDatabaseConnection } from '@/utils/prisma';

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', requestLogger);
app.use('*', errorHandler);

// Routes
app.route('/health', healthRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: config.agent.name,
    version: config.agent.version,
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    },
    404
  );
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start server
    const port = config.server.port;
    logger.info(`🚀 Starting ${config.agent.name}...`);
    logger.info(`📝 Environment: ${config.env}`);
    logger.info(`🔧 Log Level: ${config.logging.level}`);
    logger.info(`✅ Server running on http://localhost:${port}`);
    logger.info(`🏥 Health check: http://localhost:${port}/health`);
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer();
}

export default app;
