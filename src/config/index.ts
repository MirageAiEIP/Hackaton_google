import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`❌ Invalid environment variables: ${missing}`);
    }
    throw error;
  }
};

const env = parseEnv();

export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  database: {
    url: env.DATABASE_URL,
  },

  ai: {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7,
  },

  security: {
    jwtSecret: env.JWT_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  agent: {
    version: '1.0.0',
    name: 'SAMU AI Triage Agent',
  },
} as const;

export type Config = typeof config;
