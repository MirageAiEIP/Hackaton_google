import { secretManagerService } from '@/services/secret-manager.service';
import { logger } from '@/utils/logger';

interface AppSecrets {
  elevenlabsApiKey: string;
  elevenlabsAgentId: string;
  jwtSecret: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  databaseUrl: string;
  redisUrl: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
}

let secretsCache: AppSecrets | null = null;

export async function loadSecrets(): Promise<AppSecrets> {
  // Retourner le cache si déjà chargé
  if (secretsCache) {
    return secretsCache;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const useSecretManager = process.env.USE_SECRET_MANAGER === 'true';

  // Mode développement: utiliser .env directement
  if (isDevelopment && !useSecretManager) {
    logger.info('Loading secrets from environment variables (development mode)');

    secretsCache = {
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      elevenlabsAgentId: process.env.ELEVENLABS_AGENT_ID || '',
      jwtSecret: process.env.JWT_SECRET || '',
      jwtAccessSecret: process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || '',
      jwtRefreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      databaseUrl: process.env.DATABASE_URL || '',
      redisUrl: process.env.REDIS_URL || '',
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    };

    return secretsCache;
  }

  // Mode production: utiliser Secret Manager
  logger.info('Loading secrets from Google Secret Manager');

  try {
    const secrets = await secretManagerService.getSecrets([
      'elevenlabs-api-key',
      'elevenlabs-agent-id',
      'jwt-secret',
      'jwt-access-secret',
      'jwt-refresh-secret',
      'encryption-key',
      'database-url',
      'redis-url',
      'twilio-account-sid',
      'twilio-auth-token',
      'twilio-phone-number',
    ]);

    secretsCache = {
      elevenlabsApiKey: secrets['elevenlabs-api-key'] || process.env.ELEVENLABS_API_KEY || '',
      elevenlabsAgentId: secrets['elevenlabs-agent-id'] || process.env.ELEVENLABS_AGENT_ID || '',
      jwtSecret: secrets['jwt-secret'] || process.env.JWT_SECRET || '',
      jwtAccessSecret:
        secrets['jwt-access-secret'] ||
        process.env.JWT_ACCESS_TOKEN_SECRET ||
        process.env.JWT_SECRET ||
        '',
      jwtRefreshSecret:
        secrets['jwt-refresh-secret'] ||
        process.env.JWT_REFRESH_TOKEN_SECRET ||
        process.env.JWT_SECRET ||
        '',
      encryptionKey: secrets['encryption-key'] || process.env.ENCRYPTION_KEY || '',
      databaseUrl: secrets['database-url'] || process.env.DATABASE_URL || '',
      redisUrl: secrets['redis-url'] || process.env.REDIS_URL || '',
      twilioAccountSid: secrets['twilio-account-sid'] || process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: secrets['twilio-auth-token'] || process.env.TWILIO_AUTH_TOKEN || '',
      twilioPhoneNumber: secrets['twilio-phone-number'] || process.env.TWILIO_PHONE_NUMBER || '',
    };

    // Log detailed information about loaded secrets
    const secretsStatus = {
      'elevenlabs-api-key': !!secretsCache.elevenlabsApiKey,
      'elevenlabs-agent-id': !!secretsCache.elevenlabsAgentId,
      'jwt-secret': !!secretsCache.jwtSecret,
      'jwt-access-secret': !!secretsCache.jwtAccessSecret,
      'jwt-refresh-secret': !!secretsCache.jwtRefreshSecret,
      'encryption-key': !!secretsCache.encryptionKey,
      'database-url': !!secretsCache.databaseUrl,
      'redis-url': !!secretsCache.redisUrl,
      'twilio-account-sid': !!secretsCache.twilioAccountSid,
      'twilio-auth-token': !!secretsCache.twilioAuthToken,
      'twilio-phone-number': !!secretsCache.twilioPhoneNumber,
    };

    const loadedCount = Object.values(secretsStatus).filter(Boolean).length;
    const missingSecrets = Object.entries(secretsStatus)
      .filter(([, loaded]) => !loaded)
      .map(([name]) => name);

    logger.info('Secrets loaded from Secret Manager', {
      total: Object.keys(secretsStatus).length,
      loaded: loadedCount,
      missing: missingSecrets.length,
      secretsStatus,
    });

    if (missingSecrets.length > 0) {
      logger.warn('Some secrets are missing', { missingSecrets });
    }

    return secretsCache;
  } catch (error) {
    logger.error('Failed to load secrets from Secret Manager', error as Error);

    // Fallback vers les variables d'environnement
    logger.warn('Falling back to environment variables');

    secretsCache = {
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      elevenlabsAgentId: process.env.ELEVENLABS_AGENT_ID || '',
      jwtSecret: process.env.JWT_SECRET || '',
      jwtAccessSecret: process.env.JWT_ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || '',
      jwtRefreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      databaseUrl: process.env.DATABASE_URL || '',
      redisUrl: process.env.REDIS_URL || '',
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    };

    return secretsCache;
  }
}
