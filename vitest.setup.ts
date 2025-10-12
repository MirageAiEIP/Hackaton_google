import dotenv from 'dotenv';
import { beforeAll, afterAll } from 'vitest';

// Load .env.test if exists
dotenv.config({ path: '.env.test' });

// Set default fake environment variables for tests
// These are only used if not already defined (e.g., in GitHub Actions)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://fake:fake@localhost:5432/test';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'fake-google-api-key-for-tests';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'fake-openai-api-key-for-tests';

beforeAll(() => {});

afterAll(() => {});
