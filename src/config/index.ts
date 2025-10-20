import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Secrets loaded from Google Secret Manager (optional in .env)
  DATABASE_URL: z.string().url().optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().min(32).optional(),
  TWILIO_PHONE_NUMBER: z
    .string()
    .regex(/^\+\d{10,15}$/)
    .optional(),
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`Invalid environment variables: ${missing} ${error.message}`);
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
    // Will be loaded from Secret Manager if not in .env
    url: env.DATABASE_URL || '',
  },

  ai: {
    // Will be loaded from Secret Manager if not in .env
    apiKey: env.GOOGLE_API_KEY || '',
    model: 'gemini-2.0-flash-001',
    maxTokens: 2048,
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

  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || '',
    authToken: env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: env.TWILIO_PHONE_NUMBER || '',
  },

  agent: {
    version: '1.0.0',
    name: 'SAMU AI Triage Agent',
  },
} as const;

export type Config = typeof config;
