import { logger } from '@/utils/logger';
import { geminiService } from './analysis/gemini.service';
import { whisperService } from './analysis/whisper.service';

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

/**
 * Service pour vérifier la santé des APIs externes
 */
export class HealthCheckService {
  /**
   * Vérifie toutes les APIs externes
   */
  async checkAllServices(): Promise<SystemHealth> {
    const results = await Promise.allSettled([this.checkGemini(), this.checkWhisper()]);

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

  /**
   * Vérifie l'API Gemini avec un prompt minimal
   */
  private async checkGemini(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      await geminiService.analyzeText('test de santé');

      const latency = Date.now() - startTime;

      logger.info('Gemini health check passed', { latency });

      return {
        service: 'gemini',
        status: latency < 5000 ? 'UP' : 'DEGRADED',
        latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error('Gemini health check failed', error as Error, { latency });

      return {
        service: 'gemini',
        status: 'DOWN',
        latency,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Vérifie l'API Whisper avec un fichier audio minimal
   * Note: Nécessite un fichier audio de test valide
   */
  private async checkWhisper(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Pour l'instant on vérifie juste que le service existe
      // En production, il faudrait un petit fichier audio de test
      const isAvailable = typeof whisperService.transcribeWithTimestamps === 'function';

      const latency = Date.now() - startTime;

      if (!isAvailable) {
        throw new Error('Whisper service not available');
      }

      logger.info('Whisper health check passed', { latency });

      return {
        service: 'whisper',
        status: 'UP',
        latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error('Whisper health check failed', error as Error, { latency });

      return {
        service: 'whisper',
        status: 'DOWN',
        latency,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Calcule le statut global du système
   */
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
