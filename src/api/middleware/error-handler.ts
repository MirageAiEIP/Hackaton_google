import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { logger } from '@/utils/logger';

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    // Handle HTTP exceptions
    if (error instanceof HTTPException) {
      logger.warn('HTTP Exception', {
        status: error.status,
        message: error.message,
        path: c.req.path,
      });

      return c.json(
        {
          success: false,
          error: {
            code: `HTTP_${error.status}`,
            message: error.message,
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
        error.status
      );
    }

    // Handle unknown errors
    logger.error('Unhandled error', error as Error, {
      path: c.req.path,
      method: c.req.method,
    });

    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
      500
    );
  }
}
