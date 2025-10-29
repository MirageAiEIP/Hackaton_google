import { logger } from '@/utils/logger';
import { loadSecrets } from '@/config/secrets.config';

interface HealthStatus {
  service: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latency?: number;
  error?: string;
  timestamp: string;
}

interface SystemHealth {
  overall: 'UP' | 'DOWN' | 'DEGRADED';
  services: HealthStatus[];
  timestamp: string;
}

export class HealthCheckService {
  async checkAllServices(): Promise<SystemHealth> {
    const results = await Promise.allSettled([this.checkElevenLabs()]);

    const services: HealthStatus[] = results.map((result) =>
      result.status === 'fulfilled' ? result.value : result.reason
    );

    const overall = this.calculateOverallStatus(services);

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkElevenLabs(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Load secrets
      const secrets = await loadSecrets();
      const apiKey = secrets.elevenlabsApiKey;

      if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY not configured');
      }

      // Simple ping à l'API ElevenLabs
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`ElevenLabs API returned ${response.status}`);
      }

      logger.info('ElevenLabs health check passed', { latency });

      return {
        service: 'elevenlabs',
        status: latency < 2000 ? 'UP' : 'DEGRADED',
        latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error('ElevenLabs health check failed', error as Error, { latency });

      return {
        service: 'elevenlabs',
        status: 'DOWN',
        latency,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private calculateOverallStatus(services: HealthStatus[]): 'UP' | 'DOWN' | 'DEGRADED' {
    const downCount = services.filter((s) => s.status === 'DOWN').length;
    const degradedCount = services.filter((s) => s.status === 'DEGRADED').length;

    if (downCount === services.length) {
      return 'DOWN';
    }

    if (downCount > 0 || degradedCount > 0) {
      return 'DEGRADED';
    }

    return 'UP';
  }
}

export const healthCheckService = new HealthCheckService();
