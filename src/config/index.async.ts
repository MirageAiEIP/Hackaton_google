import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecrets } from './secrets.config';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  GCP_PROJECT_ID: z.string().default('samu-ai-474822'),
  USE_SECRET_MANAGER: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  GCS_BUCKET_NAME: z.string().default('samu-ai-audio-files'),
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
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
  isStaging: boolean;
  isProduction: boolean;
  isTest: boolean;
  server: { port: number };
  logging: { level: string };
  database: { url: string };
  redis: { url: string };
  ai: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  elevenlabs: {
    apiKey: string;
    agentId: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  security: {
    jwtSecret: string | undefined;
    encryptionKey: string | undefined;
  };
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  cookie: {
    domain: string;
    secure: boolean;
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
    isStaging: env.NODE_ENV === 'staging',
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

    redis: {
      url: secrets.redisUrl,
    },

    ai: {
      model: 'gemini-2.0-flash-001',
      maxTokens: 2048,
      temperature: 0.7,
    },

    elevenlabs: {
      apiKey: secrets.elevenlabsApiKey,
      agentId: secrets.elevenlabsAgentId,
    },

    twilio: {
      accountSid: secrets.twilioAccountSid,
      authToken: secrets.twilioAuthToken,
      phoneNumber: secrets.twilioPhoneNumber,
    },

    security: {
      jwtSecret: secrets.jwtSecret,
      encryptionKey: secrets.encryptionKey,
    },

    jwt: {
      accessTokenSecret: secrets.jwtAccessSecret,
      refreshTokenSecret: secrets.jwtRefreshSecret,
      accessTokenExpiry: env.JWT_ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiry: env.JWT_REFRESH_TOKEN_EXPIRY,
    },

    cookie: {
      domain: env.COOKIE_DOMAIN,
      secure: env.COOKIE_SECURE,
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
