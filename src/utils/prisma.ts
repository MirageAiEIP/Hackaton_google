import { PrismaClient } from '@prisma/client';

import { config } from '@/config';
import { logger } from '@/utils/logger';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Retirer 'query' pour alléger les logs en dev (trop verbeux)
    log: config.isDevelopment ? ['info', 'warn', 'error'] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

let isDisconnecting = false;

const disconnect = async () => {
  if (!isDisconnecting) {
    isDisconnecting = true;
    logger.info('Disconnecting Prisma Client...');
    await prisma.$disconnect();
  }
};

process.on('SIGINT', () => {
  void disconnect();
});

process.on('SIGTERM', () => {
  void disconnect();
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Database connection failed', error as Error);
    return false;
  }
}
