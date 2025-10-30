import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Container } from '@/infrastructure/di/Container';
import { loadConfig } from '@/config/index.async';
import { createAuthMiddleware, requireRole } from '@/api/middleware/auth.middleware.js';
import { Role } from '@/domain/user/entities/User.entity.js';
import { logger } from '@/utils/logger.js';

// Type definitions for request bodies and queries
// Note: Query parameters come as strings from URLs, even if they represent other types
interface ListUsersQuery {
  role?: 'OPERATOR' | 'ADMIN';
  isActive?: string; // Will be "true" or "false" as string from query param
  search?: string;
  page?: string; // Will be converted to number
  limit?: string; // Will be converted to number
}

interface UpdateUserInput {
  fullName?: string;
  role?: 'OPERATOR' | 'ADMIN';
  isActive?: boolean;
}

interface ResetPasswordInput {
  newPassword: string;
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  // Get services from DI container
  const container = Container.getInstance();
  const userService = container.getUserService();

  // Load config
  const appConfig = await loadConfig();
  const accessTokenSecret = appConfig.jwt.accessTokenSecret;

  const authenticate = createAuthMiddleware(accessTokenSecret);
  const adminOnly = requireRole('ADMIN');

  app.get<{ Querystring: ListUsersQuery }>(
    '/',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['User Management'],
        summary: 'List all users with filters (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Querystring: ListUsersQuery }>, reply: FastifyReply) => {
      try {
        const { role, isActive, search, page, limit } = request.query;

        // Convert query params to correct types (query params are always strings)
        const pageNum = page ? Number(page) : 1;
        const limitNum = limit ? Number(limit) : 20;
        const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined;

        const result = await userService.listUsers(
          { role, isActive: isActiveBool, search },
          { page: pageNum, limit: limitNum }
        );

        // Convert users to safe objects (exclude passwords)
        const safeData = result.data.map((user) => user.toSafeObject());

        return reply.send({
          data: safeData,
          pagination: result.pagination,
        });
      } catch (error) {
        logger.error('List users failed', error as Error);

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve users',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['User Management'],
        summary: 'Get user by ID (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const user = await userService.getUserById(id);

        if (!user) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'User not found',
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        return reply.send(user.toSafeObject());
      } catch (error) {
        logger.error('Get user failed', error as Error, {
          userId: request.params.id,
        });

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve user',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: UpdateUserInput }>(
    '/:id',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['User Management'],
        summary: 'Update user information (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const updates = request.body;

        // Cast role to Role enum if present
        const updateData: { fullName?: string; role?: Role; isActive?: boolean } = {
          fullName: updates.fullName,
          isActive: updates.isActive,
          role: updates.role ? (updates.role as unknown as Role) : undefined,
        };

        const user = await userService.updateUser(id, updateData);

        return reply.send(user.toSafeObject());
      } catch (error) {
        logger.error('Update user failed', error as Error, {
          userId: request.params.id,
          updates: request.body,
        });

        const message = error instanceof Error ? error.message : 'Update failed';

        if (message.includes('not found')) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message,
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message,
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['User Management'],
        summary: 'Deactivate user (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // Prevent self-deletion
        if (id === request.user!.userId) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot deactivate your own account',
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        await userService.deactivateUser(id);

        return reply.send({
          message: 'User deactivated successfully',
          id,
        });
      } catch (error) {
        logger.error('Deactivate user failed', error as Error, {
          userId: request.params.id,
        });

        const message = error instanceof Error ? error.message : 'Deactivation failed';

        if (message.includes('not found')) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message,
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to deactivate user',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: ResetPasswordInput }>(
    '/:id/password',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['User Management'],
        summary: 'Reset user password (Admin only)',
        security: [{ bearerAuth: [] }],
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: ResetPasswordInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { newPassword } = request.body;

        await userService.resetPassword(id, newPassword);

        return reply.send({
          message: 'Password reset successfully',
          id,
        });
      } catch (error) {
        logger.error('Reset password failed', error as Error, {
          userId: request.params.id,
        });

        const message = error instanceof Error ? error.message : 'Password reset failed';

        if (message.includes('not found')) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message,
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message,
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );
};
