import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for INTEGRATION TESTS with real database
 * Run manually or in staging/pre-production environments
 * Requires: DATABASE_URL, REDIS_URL, and other secrets
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'tests/**'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000, // Longer timeout for DB operations
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/agents': path.resolve(__dirname, './src/agents'),
      '@/workflows': path.resolve(__dirname, './src/workflows'),
      '@/tools': path.resolve(__dirname, './src/tools'),
      '@/rag': path.resolve(__dirname, './src/rag'),
      '@/integrations': path.resolve(__dirname, './src/integrations'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/models': path.resolve(__dirname, './src/models'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
    },
  },
});
