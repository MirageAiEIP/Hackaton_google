import { FastifyCorsOptions } from '@fastify/cors';
import { logger } from '@/utils/logger';

export interface CorsConfig {
  origin: string[] | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge?: number;
}

export function getCorsConfig(
  env: string = process.env.NODE_ENV || 'development'
): FastifyCorsOptions {
  const isDevelopment = env === 'development' || env === 'test';
  const isStaging = env === 'staging';
  const isProduction = env === 'production';

  // Development: Allow localhost on common ports
  if (isDevelopment) {
    const allowedOrigins = [
      'http://localhost:3000', // Frontend dev server (React/Next.js)
      'http://localhost:3001', // Alternative frontend port
      'http://localhost:5173', // Vite default port
      'http://localhost:8080', // Alternative dev server
      'http://localhost:8000', // Backend (for testing)
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8000',
    ];

    logger.info('CORS configured for development', { allowedOrigins });

    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: [
        'Set-Cookie',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      maxAge: 86400, // 24 hours
    };
  }

  // Staging: Controlled origins from environment variables
  if (isStaging) {
    const stagingOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : [
          'https://samu-frontend-staging-262427917999.europe-west1.run.app',
          'https://samu-frontend-staging-zblnsvceaa-ew.a.run.app',
        ];

    logger.info('CORS configured for staging', { allowedOrigins: stagingOrigins });

    return {
      origin: stagingOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Set-Cookie', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      maxAge: 86400, // 24 hours
    };
  }

  // Production: Strict - only specific production domains
  if (isProduction) {
    const productionOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : [
          'https://samu-frontend-production-262427917999.europe-west1.run.app',
          'https://samu-frontend-production-zblnsvceaa-ew.a.run.app',
        ];

    logger.info('CORS configured for production', { allowedOrigins: productionOrigins });

    return {
      origin: productionOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }

  // Default fallback (should never reach here)
  logger.warn('Unknown environment for CORS config, using restrictive defaults', { env });
  return {
    origin: false,
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: [],
  };
}

export function getCookieSameSitePolicy(
  env: string = process.env.NODE_ENV || 'development'
): 'strict' | 'lax' | 'none' {
  const isDevelopment = env === 'development' || env === 'test';
  const isStaging = env === 'staging';

  if (isDevelopment) {
    return 'lax'; // Allow cross-origin for localhost development
  }

  if (isStaging) {
    return 'lax'; // Allow some cross-origin for staging testing
  }

  // Production: strict for maximum security
  return 'strict';
}

export function getCookieDomain(
  env: string = process.env.NODE_ENV || 'development'
): string | undefined {
  const isDevelopment = env === 'development' || env === 'test';

  if (isDevelopment) {
    return 'localhost'; // Works for all localhost ports
  }

  // Staging and Production: use environment variable or undefined (current domain)
  return process.env.COOKIE_DOMAIN;
}

export function getCookieSecure(env: string = process.env.NODE_ENV || 'development'): boolean {
  const isDevelopment = env === 'development' || env === 'test';

  // Development: false (no HTTPS)
  // Staging/Production: true (HTTPS required)
  return !isDevelopment;
}
