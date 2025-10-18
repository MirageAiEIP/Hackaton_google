import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeRequestHumanHandoff } from './request-human-handoff.tool';
import { Container } from '@/infrastructure/di/Container';
import type { RequestHandoffHandler } from '@/application/commands/handoff/RequestHandoff.handler';

// Mock Container
vi.mock('@/infrastructure/di/Container', () => ({
  Container: {
    getInstance: vi.fn(),
  },
}));

describe('Request Human Handoff Tool', () => {
  let mockRequestHandoffHandler: RequestHandoffHandler;

  beforeEach(() => {
    mockRequestHandoffHandler = {
      execute: vi.fn(),
    } as any;

    vi.mocked(Container.getInstance).mockReturnValue({
      getRequestHandoffHandler: () => mockRequestHandoffHandler,
    } as any);
  });

  describe('successful handoff request', () => {
    it('should request handoff with operator available', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned to operator Jean Dupont',
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Patient requests human operator',
        transcript: 'Patient: I want to speak to a human...\nAgent: I understand...',
        patientSummary: 'Patient with chest pain, requesting human consultation',
        aiContext: { priority: 'P2', symptoms: ['chest pain'] },
      });

      expect(result.success).toBe(true);
      expect(result.handoffId).toBe('handoff-123');
      expect(result.status).toBe('REQUESTED');
      expect(result.assignedOperatorId).toBe('op-1');
      expect(result.instructions).toContain('transfère');
      expect(mockRequestHandoffHandler.execute).toHaveBeenCalledOnce();
    });

    it('should handle pending handoff when no operators available', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-456',
        status: 'PENDING',
        message: 'No operators available. Handoff request queued.',
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Patient requests human operator',
        transcript: 'Conversation...',
        patientSummary: 'Patient summary...',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.instructions).toContain('transfère');
      expect(result.message).toContain('No operators available');
    });

    it('should pass all required fields to handler', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned',
      });

      await executeRequestHumanHandoff({
        callId: 'call-789',
        conversationId: 'conv-012',
        reason: 'Complex medical case',
        transcript: 'Full transcript here...',
        patientSummary: 'Detailed summary...',
        aiContext: { priority: 'P1', redFlags: ['severe bleeding'] },
      });

      const executeMock = vi.mocked(mockRequestHandoffHandler.execute);
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: 'call-789',
          conversationId: 'conv-012',
          reason: 'Complex medical case',
          fromAgent: true,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle handler execution errors', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Patient requests human operator',
        transcript: 'Transcript...',
        patientSummary: 'Summary...',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to request handoff');
    });

    it('should handle container initialization errors', async () => {
      vi.mocked(Container.getInstance).mockImplementation(() => {
        throw new Error('Container not initialized');
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Test',
        transcript: 'Test',
        patientSummary: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('reason validation', () => {
    it('should handle different handoff reasons', async () => {
      const reasons = [
        'Patient requests human operator',
        'Complex medical case requiring specialist',
        'Technical issue with AI conversation',
        'Patient prefers human interaction',
      ];

      for (const reason of reasons) {
        vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
          handoffId: 'handoff-123',
          status: 'REQUESTED',
          assignedOperatorId: 'op-1',
          message: 'Handoff assigned',
        });

        const result = await executeRequestHumanHandoff({
          callId: 'call-123',
          conversationId: 'conv-456',
          reason,
          transcript: 'Transcript...',
          patientSummary: 'Summary...',
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('context transfer', () => {
    it('should transfer AI context to operator', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned',
      });

      const aiContext = {
        priority: 'P1',
        symptoms: ['chest pain', 'shortness of breath'],
        redFlags: ['crushing chest pain'],
        assessments: {
          airway: 'clear',
          breathing: 'labored',
          circulation: 'weak pulse',
          disability: 'alert',
        },
      };

      await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'High priority case',
        transcript: 'Full conversation...',
        patientSummary: 'Patient with suspected MI',
        aiContext,
      });

      const executeMock = vi.mocked(mockRequestHandoffHandler.execute);
      const command = executeMock.mock.calls[0]?.[0];
      expect(command?.aiContext).toEqual(aiContext);
    });

    it('should handle missing optional context', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned',
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Patient requests human operator',
        transcript: 'Transcript...',
        patientSummary: 'Summary...',
        // aiContext is optional
      });

      expect(result.success).toBe(true);
    });
  });

  describe('response format', () => {
    it('should return user-friendly instructions in French', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned to operator Jean Dupont',
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Test',
        transcript: 'Test',
        patientSummary: 'Test',
      });

      expect(result.instructions).toMatch(/transfère|opérateur/i);
      expect(result.instructions).toContain('humain');
    });

    it('should include all relevant information', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned to operator Marie Dupont',
      });

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Test',
        transcript: 'Test',
        patientSummary: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.handoffId).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.instructions).toBeDefined();
    });
  });

  describe('transcript and summary', () => {
    it('should handle long transcripts', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned',
      });

      const longTranscript = 'A'.repeat(10000); // 10k characters

      const result = await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Test',
        transcript: longTranscript,
        patientSummary: 'Summary...',
      });

      expect(result.success).toBe(true);
      const executeMock = vi.mocked(mockRequestHandoffHandler.execute);
      const command = executeMock.mock.calls[0]?.[0];
      expect(command?.transcript).toBe(longTranscript);
    });

    it('should preserve transcript formatting', async () => {
      vi.mocked(mockRequestHandoffHandler.execute).mockResolvedValue({
        handoffId: 'handoff-123',
        status: 'REQUESTED',
        assignedOperatorId: 'op-1',
        message: 'Handoff assigned',
      });

      const formattedTranscript = `Patient: Hello, I have chest pain.
Agent: Can you describe the pain?
Patient: It's a crushing sensation.`;

      await executeRequestHumanHandoff({
        callId: 'call-123',
        conversationId: 'conv-456',
        reason: 'Test',
        transcript: formattedTranscript,
        patientSummary: 'Summary...',
      });

      const executeMock = vi.mocked(mockRequestHandoffHandler.execute);
      const command = executeMock.mock.calls[0]?.[0];
      expect(command?.transcript).toBe(formattedTranscript);
    });
  });
});
