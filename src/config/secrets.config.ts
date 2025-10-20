import { secretManagerService } from '@/services/secret-manager.service';
import { logger } from '@/utils/logger';

/**
 * Configuration qui charge les secrets depuis Google Secret Manager
 * Fallback vers les variables d'environnement pour le développement local
 */

interface AppSecrets {
  googleApiKey: string;
  elevenlabsApiKey: string;
  jwtSecret: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  databaseUrl: string;
}

let secretsCache: AppSecrets | null = null;

/**
 * Charge tous les secrets nécessaires à l'application
 * Mode hybride: Secret Manager en production, .env en développement
 */
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
      googleApiKey: process.env.GOOGLE_API_KEY || '',
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      jwtSecret: process.env.JWT_SECRET || '',
      jwtAccessSecret: process.env.JWT_SECRET || '', // Fallback to JWT_SECRET for dev
      jwtRefreshSecret: process.env.JWT_SECRET || '', // Fallback to JWT_SECRET for dev
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      databaseUrl: process.env.DATABASE_URL || '',
    };

    return secretsCache;
  }

  // Mode production: utiliser Secret Manager
  logger.info('Loading secrets from Google Secret Manager');

  try {
    const secrets = await secretManagerService.getSecrets([
      'google-api-key',
      'elevenlabs-api-key',
      'jwt-secret',
      'jwt-access-secret',
      'jwt-refresh-secret',
      'encryption-key',
      'database-url',
    ]);

    secretsCache = {
      googleApiKey: secrets['google-api-key'] || process.env.GOOGLE_API_KEY || '',
      elevenlabsApiKey: secrets['elevenlabs-api-key'] || process.env.ELEVENLABS_API_KEY || '',
      jwtSecret: secrets['jwt-secret'] || process.env.JWT_SECRET || '',
      jwtAccessSecret: secrets['jwt-access-secret'] || process.env.JWT_SECRET || '',
      jwtRefreshSecret: secrets['jwt-refresh-secret'] || process.env.JWT_SECRET || '',
      encryptionKey: secrets['encryption-key'] || process.env.ENCRYPTION_KEY || '',
      databaseUrl: secrets['database-url'] || process.env.DATABASE_URL || '',
    };

    logger.info('Secrets loaded successfully from Secret Manager', {
      count: Object.keys(secrets).length,
    });

    return secretsCache;
  } catch (error) {
    logger.error('Failed to load secrets from Secret Manager', error as Error);

    // Fallback vers les variables d'environnement
    logger.warn('Falling back to environment variables');

    secretsCache = {
      googleApiKey: process.env.GOOGLE_API_KEY || '',
      elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      jwtSecret: process.env.JWT_SECRET || '',
      jwtAccessSecret: process.env.JWT_SECRET || '',
      jwtRefreshSecret: process.env.JWT_SECRET || '',
      encryptionKey: process.env.ENCRYPTION_KEY || '',
      databaseUrl: process.env.DATABASE_URL || '',
    };

    return secretsCache;
  }
}

/**
 * Récupère un secret spécifique
 */
export async function getSecret(
  secretName:
    | 'google-api-key'
    | 'elevenlabs-api-key'
    | 'jwt-secret'
    | 'encryption-key'
    | 'database-url'
): Promise<string> {
  const secrets = await loadSecrets();

  const mapping: Record<string, keyof AppSecrets> = {
    'google-api-key': 'googleApiKey',
    'elevenlabs-api-key': 'elevenlabsApiKey',
    'jwt-secret': 'jwtSecret',
    'encryption-key': 'encryptionKey',
    'database-url': 'databaseUrl',
  };

  const mappedKey = mapping[secretName];
  if (!mappedKey) {
    throw new Error(`Unknown secret name: ${secretName}`);
  }

  return secrets[mappedKey];
}

/**
 * Recharge les secrets (utile après une mise à jour)
 */
export function reloadSecrets(): void {
  secretsCache = null;
  secretManagerService.clearCache();
  logger.info('Secrets cache cleared');
}
