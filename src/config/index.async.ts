import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecrets } from './secrets.config';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  GCP_PROJECT_ID: z.string().default('samu-ai-474822'),
  USE_SECRET_MANAGER: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GCS_BUCKET_NAME: z.string().default('samu-ai-audio-files'),
});

const parseEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`Invalid environment variables: ${missing}`);
    }
    throw error;
  }
};

const env = parseEnv();

interface AppConfig {
  env: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  server: { port: number };
  logging: { level: string };
  database: { url: string };
  ai: {
    googleApiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  security: {
    jwtSecret: string | undefined;
    encryptionKey: string | undefined;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  gcp: {
    projectId: string;
    bucketName: string;
  };
  agent: {
    version: string;
    name: string;
  };
}

let configCache: AppConfig | null = null;

/**
 * Charge la configuration de l'application avec les secrets
 * Mode hybride: Secret Manager en production, .env en développement
 */
export async function loadConfig(): Promise<AppConfig> {
  if (configCache) {
    return configCache;
  }

  // Charger les secrets
  const secrets = await loadSecrets();

  configCache = {
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
      url: secrets.databaseUrl,
    },

    ai: {
      googleApiKey: secrets.googleApiKey,
      model: 'gemini-2.0-flash-001',
      maxTokens: 2048,
      temperature: 0.7,
    },

    security: {
      jwtSecret: secrets.jwtSecret,
      encryptionKey: secrets.encryptionKey,
    },

    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },

    gcp: {
      projectId: env.GCP_PROJECT_ID,
      bucketName: env.GCS_BUCKET_NAME,
    },

    agent: {
      version: '1.0.0',
      name: 'SAMU AI Triage Agent',
    },
  };

  return configCache;
}

/**
 * Configuration statique (sans secrets sensibles)
 * Utiliser loadConfig() pour obtenir la config complète
 */
export const staticConfig = {
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

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  gcp: {
    projectId: env.GCP_PROJECT_ID,
    bucketName: env.GCS_BUCKET_NAME,
  },

  agent: {
    version: '1.0.0',
    name: 'SAMU AI Triage Agent',
  },
} as const;

export type Config = AppConfig;
