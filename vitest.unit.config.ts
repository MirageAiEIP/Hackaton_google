import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for UNIT TESTS with mocks
 * Used by CI/CD for fast, isolated testing
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/*.config.ts',
        'prisma/**',
        'tests/**',
      ],
      // No thresholds - coverage is informational only
    },
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'tests/integration/**'],
    testTimeout: 5000, // Faster timeout for unit tests
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
