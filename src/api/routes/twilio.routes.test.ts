import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '@/server';
import { FastifyInstance } from 'fastify';

describe('Twilio Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/v1/twilio/post-call-webhook', () => {
    it('should process post-call data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/twilio/post-call-webhook',
        payload: {
          call_sid: 'CA123456789',
          call_duration_seconds: 120,
          transcript: 'Bonjour, je me sens mal...',
          metadata: {
            priority: 'P1',
            dispatch_triggered: true,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json).toHaveProperty('success', true);
    });
  });
});
