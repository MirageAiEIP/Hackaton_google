#!/usr/bin/env tsx
/**
 * Script pour vérifier manuellement la santé des APIs externes
 *
 * Usage: npm run health:check
 */

/* eslint-disable no-console */

import { healthCheckService } from '../src/services/health-check.service';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

async function main() {
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}VERIFICATION DES APIS EXTERNES${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

  const startTime = Date.now();

  try {
    const health = await healthCheckService.checkAllServices();

    console.log(`${colors.blue}Status global: ${getStatusColor(health.overall)}${health.overall}${colors.reset}\n`);

    console.log(`${colors.cyan}Details par service:${colors.reset}`);
    console.log(`${colors.cyan}${'-'.repeat(60)}${colors.reset}`);

    for (const service of health.services) {
      const statusColor = getStatusColor(service.status);
      const icon = service.status === 'UP' ? '✓' : service.status === 'DEGRADED' ? '⚠' : '✗';

      console.log(
        `${icon} ${colors.blue}${service.service.toUpperCase()}${colors.reset}: ${statusColor}${service.status}${colors.reset}`
      );

      if (service.latency) {
        const latencyColor = service.latency < 2000 ? colors.green : service.latency < 5000 ? colors.yellow : colors.red;
        console.log(`   Latence: ${latencyColor}${service.latency}ms${colors.reset}`);
      }

      if (service.error) {
        console.log(`   ${colors.red}Erreur: ${service.error}${colors.reset}`);
      }

      console.log();
    }

    const totalTime = Date.now() - startTime;
    console.log(`${colors.cyan}${'-'.repeat(60)}${colors.reset}`);
    console.log(`Temps total: ${totalTime}ms`);
    console.log(`Timestamp: ${health.timestamp}\n`);

    // Exit code
    if (health.overall === 'DOWN') {
      console.log(`${colors.red}ALERTE: Système DOWN - vérifier les APIs immédiatement${colors.reset}\n`);
      process.exit(1);
    } else if (health.overall === 'DEGRADED') {
      console.log(`${colors.yellow}ATTENTION: Système dégradé - surveiller les APIs${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.green}Toutes les APIs sont fonctionnelles${colors.reset}\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`${colors.red}ERREUR FATALE:${colors.reset}`, error);
    process.exit(1);
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'UP':
      return colors.green;
    case 'DEGRADED':
      return colors.yellow;
    case 'DOWN':
      return colors.red;
    default:
      return colors.reset;
  }
}

main();
