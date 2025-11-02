import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '@/infrastructure/auth/jwt.util.js';
import { logger } from '@/utils/logger.js';

// Extend Fastify types to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      employeeId: string;
      fullName: string;
      role: 'OPERATOR' | 'ADMIN';
      operatorId: string | null;
    };
  }
}

export function createAuthMiddleware(accessTokenSecret: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authorization header is missing',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Check Bearer format
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authorization format. Expected: Bearer <token>',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      const token = parts[1];

      if (!token) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token is missing',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }

      // Verify token
      const decoded = verifyAccessToken(token, accessTokenSecret);

      // Attach user to request
      request.user = {
        userId: decoded.userId,
        employeeId: decoded.employeeId,
        fullName: decoded.fullName,
        role: decoded.role,
        operatorId: decoded.operatorId,
      };
    } catch (error) {
      logger.error('Authentication failed', error as Error, {
        path: request.url,
      });

      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: error instanceof Error ? error.message : 'Invalid or expired token',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  };
}

export function requireRole(...allowedRoles: Array<'OPERATOR' | 'ADMIN'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // User should be attached by auth middleware
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // Check if user has required role
    if (!allowedRoles.includes(request.user.role)) {
      logger.warn('Access denied - insufficient permissions', {
        userId: request.user.userId,
        userRole: request.user.role,
        requiredRoles: allowedRoles,
        path: request.url,
      });

      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  };
}
