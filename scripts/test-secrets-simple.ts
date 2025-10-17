#!/usr/bin/env tsx
/**
 * Script simplifié pour tester le chargement des secrets
 */

/* eslint-disable no-console */

import dotenv from 'dotenv';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import path from 'path';

dotenv.config();

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'samu-ai-474822';
const USE_SECRET_MANAGER = process.env.USE_SECRET_MANAGER === 'true';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

async function testSecrets() {
  console.log(`${colors.cyan}${'='.repeat(60)}`);
  console.log(`TEST GOOGLE SECRET MANAGER`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  USE_SECRET_MANAGER: ${USE_SECRET_MANAGER}`);
  console.log(
    `  Mode: ${USE_SECRET_MANAGER ? colors.magenta + 'Secret Manager' : colors.yellow + '.env file'}${colors.reset}\n`
  );

  if (!USE_SECRET_MANAGER) {
    console.log(`${colors.red}❌ USE_SECRET_MANAGER=false${colors.reset}`);
    console.log(`Pour tester Secret Manager, mettez USE_SECRET_MANAGER=true dans .env\n`);
    return;
  }

  try {
    console.log(`${colors.yellow}Chargement des secrets depuis Secret Manager...${colors.reset}\n`);

    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let keyFilename: string | undefined;

    if (credentialsPath) {
      keyFilename = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.resolve(process.cwd(), credentialsPath);
    }

    const client = new SecretManagerServiceClient({ keyFilename });

    // Déterminer le préfixe selon NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    const envPrefix = nodeEnv === 'production' ? 'prod' : 'dev';

    console.log(`   Préfixe utilisé: ${envPrefix}-\n`);

    const secretNames = [
      'google-api-key',
      'elevenlabs-api-key',
      'jwt-secret',
      'encryption-key',
      'database-url',
    ];

    let successCount = 0;
    let failureCount = 0;

    for (const secretName of secretNames) {
      const fullSecretName = `${envPrefix}-${secretName}`;
      try {
        const name = `projects/${PROJECT_ID}/secrets/${fullSecretName}/versions/latest`;
        const [response] = await client.accessSecretVersion({ name });
        const secretValue = response.payload?.data?.toString();

        if (secretValue && secretValue.length > 0) {
          const preview = `${secretValue.substring(0, 20)}...${secretValue.substring(secretValue.length - 4)}`;
          console.log(`${colors.green}✅ ${fullSecretName}${colors.reset}`);
          console.log(`   Valeur: ${preview}\n`);
          successCount++;
        } else {
          console.log(`${colors.red}❌ ${fullSecretName}${colors.reset}`);
          console.log(`   Valeur: (empty)\n`);
          failureCount++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`${colors.red}❌ ${fullSecretName}${colors.reset}`);
        console.log(`   Erreur: ${errorMessage}\n`);
        failureCount++;
      }
    }

    console.log(`${colors.cyan}${'='.repeat(60)}`);
    console.log(`RÉSULTATS`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.green}Secrets chargés: ${successCount}/5${colors.reset}`);
    if (failureCount > 0) {
      console.log(`${colors.red}Secrets manquants: ${failureCount}/5${colors.reset}`);
    }

    if (successCount === 5) {
      console.log(
        `\n${colors.green}✅ Tous les secrets sont disponibles dans Secret Manager !${colors.reset}`
      );
      process.exit(0);
    } else {
      console.log(
        `\n${colors.red}❌ Certains secrets sont manquants.${colors.reset}`
      );
      process.exit(1);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n${colors.red}❌ Erreur:${colors.reset}`, errorMessage);
    process.exit(1);
  }
}

testSecrets();
