import { z } from 'zod';
import { handoffService } from '@/services/handoff.service';
import { logger } from '@/utils/logger';

/**
 * ElevenLabs Client Tool: Request Human Handoff
 * Called by AI agent when patient requests human operator
 * or when AI determines human intervention is needed
 */

/**
 * Tool input schema (validated with Zod)
 */
export const requestHumanHandoffSchema = z.object({
  callId: z.string().describe('Unique call identifier'),
  conversationId: z.string().describe('ElevenLabs conversation ID'),
  reason: z
    .string()
    .describe(
      'Reason for handoff (e.g., "Patient requested human", "Complex medical case", "Escalation needed")'
    ),
  transcript: z.string().describe('Full conversation transcript up to this point'),
  patientSummary: z
    .string()
    .describe('AI-generated summary of patient situation (symptoms, urgency, key information)'),
  aiContext: z
    .record(z.any())
    .optional()
    .describe('Additional AI context (detected symptoms, priority, etc.)'),
});

export type RequestHumanHandoffInput = z.infer<typeof requestHumanHandoffSchema>;

/**
 * Tool execution function
 * Called when ElevenLabs agent invokes this tool
 */
export async function executeRequestHumanHandoff(input: RequestHumanHandoffInput) {
  const { callId, conversationId, reason, transcript, patientSummary, aiContext } = input;

  logger.info('Client Tool: request_human_handoff called', {
    callId,
    conversationId,
    reason,
  });

  try {
    // Use handoff service to request handoff from AI agent
    const result = await handoffService.requestHandoffFromAgent({
      callId,
      conversationId,
      reason,
      transcript,
      patientSummary,
      aiContext,
    });

    logger.info('Handoff requested successfully', {
      handoffId: result.handoffId,
      callId,
      status: result.status,
    });

    return {
      success: true,
      handoffId: result.handoffId,
      status: result.status,
      message: result.message,
      assignedOperatorId: result.assignedOperatorId,
      instructions:
        'Please inform the patient: "Je vous transfère vers un opérateur humain qui pourra mieux vous aider. Veuillez patienter un instant."',
    };
  } catch (error) {
    logger.error('Failed to request handoff', error as Error, {
      callId,
      conversationId,
    });

    return {
      success: false,
      error: 'Failed to request handoff',
      message: (error as Error).message,
      fallbackInstructions:
        'Unable to transfer to human operator at this moment. Please continue assisting the patient and attempt handoff again later.',
    };
  }
}

/**
 * Tool definition for ElevenLabs dashboard configuration
 */
export const requestHumanHandoffToolDefinition = {
  name: 'request_human_handoff',
  description:
    'Request handoff from AI agent to human operator. Use this when:\n- Patient explicitly requests to speak with a human\n- Medical case is too complex for AI triage\n- Patient is distressed and needs human empathy\n- Escalation to doctor/specialist is needed\n\nProvides full conversation context to operator.',
  parameters: requestHumanHandoffSchema,
  execute: executeRequestHumanHandoff,
};
