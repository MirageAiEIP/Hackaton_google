import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Container } from '@/infrastructure/di/Container';
import { loadConfig } from '@/config/index.async';
import { getCookieSameSitePolicy, getCookieDomain, getCookieSecure } from '@/config/cors.config';
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from '@/api/validation/auth.validation.js';
import { createAuthMiddleware, requireRole } from '@/api/middleware/auth.middleware.js';
import { Role } from '@/domain/user/entities/User.entity.js';
import { logger } from '@/utils/logger.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Get services from DI container
  const container = Container.getInstance();
  const authService = container.getAuthService();
  const userService = container.getUserService();

  // Load config
  const appConfig = await loadConfig();
  const accessTokenSecret = appConfig.jwt.accessTokenSecret;

  // Get environment-specific cookie settings
  const nodeEnv = process.env.NODE_ENV || 'development';
  const cookieDomain = getCookieDomain(nodeEnv);
  const cookieSecure = getCookieSecure(nodeEnv);
  const cookieSameSite = getCookieSameSitePolicy(nodeEnv);

  const authenticate = createAuthMiddleware(accessTokenSecret);
  const adminOnly = requireRole('ADMIN');

  app.post<{ Body: RegisterInput }>(
    '/register',
    {
      preHandler: [authenticate, adminOnly],
      schema: {
        tags: ['Authentication'],
        summary: 'Register a new user (Admin only)',
        description: 'Admin creates a new user account with employee ID and role',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['employeeId', 'fullName', 'password', 'role'],
          properties: {
            employeeId: { type: 'string', minLength: 3 },
            fullName: { type: 'string', minLength: 2 },
            password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['OPERATOR', 'ADMIN'] },
          },
        },
        response: {
          201: {
            description: 'User created successfully',
            type: 'object',
            properties: {
              id: { type: 'string' },
              employeeId: { type: 'string' },
              fullName: { type: 'string' },
              role: { type: 'string' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) => {
      try {
        const { employeeId, fullName, password, role } = request.body;

        const user = await authService.register({
          employeeId,
          fullName,
          password,
          role: role as Role,
          createdByUserId: request.user!.userId,
        });

        return reply.status(201).send(user);
      } catch (error) {
        logger.error('Registration failed', error as Error, {
          employeeId: request.body.employeeId,
        });

        const message = error instanceof Error ? error.message : 'Registration failed';

        if (message.includes('already exists')) {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
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

  app.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'User login',
        description:
          'Authenticate with employee ID and password. Returns access token and sets refresh token cookie.',
        body: {
          type: 'object',
          required: ['employeeId', 'password'],
          properties: {
            employeeId: { type: 'string' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Login successful',
            type: 'object',
            properties: {
              accessToken: { type: 'string', description: 'JWT access token' },
              tokenType: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
      try {
        const { employeeId, password } = request.body;
        const userAgent = request.headers['user-agent'];

        const result = await authService.login(employeeId, password, userAgent);

        // Set refresh token as httpOnly cookie with environment-specific settings
        reply.setCookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: cookieSecure,
          sameSite: cookieSameSite,
          maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          path: '/api/v1/auth',
          domain: cookieDomain,
        });

        // Return access token in response body
        return reply.send({
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
        });
      } catch (error) {
        logger.error('Login failed', error as Error, {
          employeeId: request.body.employeeId,
        });

        const message = error instanceof Error ? error.message : 'Login failed';

        if (message.includes('Invalid credentials')) {
          return reply.status(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid employee ID or password',
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        if (message.includes('deactivated')) {
          return reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'Account is deactivated',
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Login failed',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get a new access token using the refresh token cookie',
        response: {
          200: {
            description: 'Token refreshed successfully',
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              tokenType: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const refreshToken = request.cookies.refreshToken;

        if (!refreshToken) {
          return reply.status(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Refresh token is missing',
            },
            timestamp: new Date().toISOString(),
            path: request.url,
          });
        }

        const result = await authService.refreshAccessToken(refreshToken);

        return reply.send(result);
      } catch (error) {
        logger.error('Token refresh failed', error as Error);

        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: error instanceof Error ? error.message : 'Invalid or expired refresh token',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.post(
    '/logout',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication'],
        summary: 'Logout current device',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const refreshToken = request.cookies.refreshToken;

        if (refreshToken) {
          await authService.logout(request.user!.userId, refreshToken);
        }

        // Clear refresh token cookie
        reply.clearCookie('refreshToken', {
          path: '/api/v1/auth',
          domain: cookieDomain,
        });

        return reply.send({
          message: 'Logged out successfully',
        });
      } catch (error) {
        logger.error('Logout failed', error as Error, {
          userId: request.user!.userId,
        });

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Logout failed',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.post(
    '/logout-all',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication'],
        summary: 'Logout from all devices',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await authService.logoutAllDevices(request.user!.userId);

        // Clear refresh token cookie
        reply.clearCookie('refreshToken', {
          path: '/api/v1/auth',
          domain: cookieDomain,
        });

        return reply.send({
          message: 'Logged out from all devices successfully',
        });
      } catch (error) {
        logger.error('Logout all devices failed', error as Error, {
          userId: request.user!.userId,
        });

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Logout failed',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication'],
        summary: 'Get current user information',
        description: 'Returns the authenticated user profile',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'User profile',
            type: 'object',
            properties: {
              id: { type: 'string' },
              employeeId: { type: 'string' },
              fullName: { type: 'string' },
              role: { type: 'string', enum: ['OPERATOR', 'ADMIN'] },
              operatorId: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = await userService.getUserById(request.user!.userId);

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

        const safeUser = user.toSafeObject();

        return reply.send(safeUser);
      } catch (error) {
        logger.error('Get current user failed', error as Error, {
          userId: request.user!.userId,
        });

        return reply.status(500).send({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve user information',
          },
          timestamp: new Date().toISOString(),
          path: request.url,
        });
      }
    }
  );

  app.patch<{ Body: ChangePasswordInput }>(
    '/change-password',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Authentication'],
        summary: 'Change own password',
        description: 'Update your password by providing current and new password',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['oldPassword', 'newPassword'],
          properties: {
            oldPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: {
            description: 'Password changed successfully',
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ChangePasswordInput }>, reply: FastifyReply) => {
      try {
        const { oldPassword, newPassword } = request.body;

        await userService.changePassword(request.user!.userId, oldPassword, newPassword);

        return reply.send({
          message: 'Password changed successfully',
        });
      } catch (error) {
        logger.error('Change password failed', error as Error, {
          userId: request.user!.userId,
        });

        const message = error instanceof Error ? error.message : 'Password change failed';

        if (message.includes('incorrect')) {
          return reply.status(401).send({
            error: {
              code: 'UNAUTHORIZED',
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
