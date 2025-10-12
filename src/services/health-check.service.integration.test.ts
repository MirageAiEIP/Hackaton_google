import { describe, it, expect } from 'vitest';
import { healthCheckService } from './health-check.service';

/**
 * Tests d'intégration pour vérifier que les APIs externes sont UP
 *
 * IMPORTANT: Ces tests appellent vraiment les APIs (Gemini, Whisper)
 * - Consomment des tokens
 * - Peuvent échouer si les APIs sont down
 * - À lancer manuellement avec: npm run test:integration
 *
 * Ne PAS lancer dans la CI/CD automatique
 */
describe('HealthCheckService - Integration Tests', () => {
  it('should verify Gemini API is UP', async () => {
    const result = await healthCheckService.checkAllServices();

    const geminiStatus = result.services.find((s) => s.service === 'gemini');

    expect(geminiStatus).toBeDefined();
    expect(geminiStatus?.status).toMatch(/UP|DEGRADED/);

    if (geminiStatus?.status === 'UP') {
      expect(geminiStatus.latency).toBeLessThan(10000);
    }

    console.log('Gemini Status:', geminiStatus);
  }, 15000); // 15s timeout

  it('should verify Whisper API is UP', async () => {
    const result = await healthCheckService.checkAllServices();

    const whisperStatus = result.services.find((s) => s.service === 'whisper');

    expect(whisperStatus).toBeDefined();
    expect(whisperStatus?.status).toMatch(/UP|DEGRADED/);

    console.log('Whisper Status:', whisperStatus);
  }, 15000);

  it('should calculate overall system health', async () => {
    const result = await healthCheckService.checkAllServices();

    expect(result.overall).toMatch(/UP|DOWN|DEGRADED/);
    expect(result.services).toHaveLength(2);
    expect(result.timestamp).toBeDefined();

    console.log('Overall System Health:', {
      overall: result.overall,
      services: result.services.map((s) => ({
        service: s.service,
        status: s.status,
        latency: s.latency,
      })),
    });
  }, 20000);

  it('should detect when system is DEGRADED', async () => {
    const result = await healthCheckService.checkAllServices();

    // Si une API est DOWN ou DEGRADED, le système doit être DEGRADED
    const hasIssues = result.services.some((s) => s.status !== 'UP');

    if (hasIssues) {
      expect(result.overall).toMatch(/DEGRADED|DOWN/);
    }
  }, 20000);

  it('should provide error details when API is DOWN', async () => {
    const result = await healthCheckService.checkAllServices();

    const downServices = result.services.filter((s) => s.status === 'DOWN');

    if (downServices.length > 0) {
      downServices.forEach((service) => {
        expect(service.error).toBeDefined();
        console.log(`${service.service} is DOWN:`, service.error);
      });
    }
  }, 20000);
});
