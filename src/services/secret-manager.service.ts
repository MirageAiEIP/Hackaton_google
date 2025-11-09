import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '@/utils/logger';
import { getGoogleCredentialsPath } from '@/utils/google-credentials';

export class SecretManagerService {
  private client: SecretManagerServiceClient;
  private projectId: string;
  private envPrefix: string; // dev-, staging- ou prod-
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  constructor() {
    // Auto-détection du fichier credentials dans config/
    const keyFilename = getGoogleCredentialsPath();

    this.client = new SecretManagerServiceClient({ keyFilename });

    // Extraire le project ID depuis le service account JSON
    this.projectId = process.env.GCP_PROJECT_ID || 'gaia-477710';

    // Déterminer le préfixe selon l'environnement
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      this.envPrefix = 'prod';
    } else if (nodeEnv === 'staging') {
      this.envPrefix = 'staging';
    } else {
      this.envPrefix = 'dev';
    }

    logger.info('Secret Manager service initialized', {
      projectId: this.projectId,
      environment: nodeEnv,
      secretPrefix: this.envPrefix,
    });
  }

  async getSecret(secretName: string, version: string = 'latest'): Promise<string> {
    // Ajouter le préfixe d'environnement (dev-, staging- ou prod-)
    const fullSecretName = `${this.envPrefix}-${secretName}`;
    const cacheKey = `${fullSecretName}:${version}`;

    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Secret retrieved from cache', { secretName: fullSecretName });
      return cached.value;
    }

    try {
      const name = `projects/${this.projectId}/secrets/${fullSecretName}/versions/${version}`;

      logger.debug('Fetching secret from Secret Manager', {
        secretName: fullSecretName,
        version,
      });

      const [response] = await this.client.accessSecretVersion({ name });
      const secretValue = response.payload?.data?.toString();

      if (!secretValue) {
        throw new Error(`Secret ${fullSecretName} is empty`);
      }

      // Mettre en cache
      this.cache.set(cacheKey, { value: secretValue, timestamp: Date.now() });

      logger.info('Secret retrieved successfully', {
        secretName: fullSecretName,
        environment: this.envPrefix,
      });
      return secretValue;
    } catch (error) {
      logger.error('Failed to retrieve secret', error as Error, {
        secretName: fullSecretName,
        version,
      });
      throw new Error(`Could not access secret: ${fullSecretName}`);
    }
  }

  async getSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const results = await Promise.allSettled(secretNames.map((name) => this.getSecret(name)));

    const secrets: Record<string, string> = {};

    results.forEach((result, index) => {
      const secretName = secretNames[index];
      if (!secretName) {
        return;
      }

      if (result.status === 'fulfilled') {
        secrets[secretName] = result.value;
      } else {
        logger.warn('Failed to fetch secret', { secretName, error: result.reason });
      }
    });

    return secrets;
  }

  async createOrUpdateSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      const parent = `projects/${this.projectId}`;

      // Vérifier si le secret existe
      try {
        await this.client.getSecret({ name: `${parent}/secrets/${secretName}` });

        // Secret existe, ajouter une nouvelle version
        await this.client.addSecretVersion({
          parent: `${parent}/secrets/${secretName}`,
          payload: {
            data: Buffer.from(secretValue, 'utf8'),
          },
        });

        logger.info('Secret version added', { secretName });
      } catch {
        // Secret n'existe pas, le créer
        await this.client.createSecret({
          parent,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // Ajouter la première version
        await this.client.addSecretVersion({
          parent: `${parent}/secrets/${secretName}`,
          payload: {
            data: Buffer.from(secretValue, 'utf8'),
          },
        });

        logger.info('Secret created', { secretName });
      }

      // Invalider le cache
      this.cache.delete(`${secretName}:latest`);
    } catch (error) {
      logger.error('Failed to create/update secret', error as Error, { secretName });
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Secret cache cleared');
  }
}

export const secretManagerService = new SecretManagerService();
