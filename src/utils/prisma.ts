import { PrismaClient } from '@prisma/client';

import { config } from '@/config';
import { logger } from '@/utils/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDevelopment ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

process.on('beforeExit', async () => {
  logger.info('Disconnecting Prisma Client...');
  await prisma.$disconnect();
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', error as Error);
    return false;
  }
}
