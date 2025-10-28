import { IEventHandler } from '@/domain/shared/IEventBus';
import { CallStartedEvent } from '@/domain/triage/events/CallStarted.event';
import { logger } from '@/utils/logger';
import { callService } from '@/services/call.service';
import { twilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';

/**
 * Event Handler: Notify ElevenLabs agent about patient's recent call history
 *
 * When a call starts:
 * 1. Get the patient's previous calls in the last 24 hours
 * 2. Format the call history in French
 * 3. Send as a contextual_update to the ElevenLabs agent
 *
 * This helps the agent provide better context-aware assistance
 */
export class CallHistoryNotificationHandler implements IEventHandler<CallStartedEvent> {
  // Retry configuration for WebSocket connection readiness
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_DELAY_MS = 500;
  private readonly MAX_DELAY_MS = 5000;

  constructor() {}

  async handle(event: CallStartedEvent): Promise<void> {
    logger.info('Handling CallStarted event for call history notification', {
      callId: event.callId,
      eventId: event.id,
    });

    try {
      // Get the call details including patient info
      const call = await callService.getCallById(event.callId);

      if (!call || !call.patientId) {
        logger.warn('Call or patient not found for call history notification', {
          callId: event.callId,
        });
        return;
      }

      // Get patient's previous calls in the last 24 hours (excluding current call)
      const recentCalls = await callService.getRecentCallsByPatient(
        call.patientId,
        24, // hours
        event.callId // exclude current call
      );

      if (!recentCalls || recentCalls.length === 0) {
        logger.info('No recent calls found for patient, skipping history notification', {
          callId: event.callId,
          patientId: call.patientId,
        });
        return;
      }

      // Format the call history message in French
      const historyMessage = this.formatCallHistory(recentCalls);

      // Send contextual update to the ElevenLabs agent with retry logic
      await this.sendContextualUpdateWithRetry(event.callId, historyMessage);

      logger.info('Call history notification sent successfully', {
        callId: event.callId,
        previousCallsCount: recentCalls.length,
      });
    } catch (error) {
      logger.error('Failed to send call history notification', error as Error, {
        callId: event.callId,
      });
    }
  }

  /**
   * Format call history as a contextual message in French
   */
  private formatCallHistory(
    calls: Array<{
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      chiefComplaint: string | null;
      priority: string | null;
      status: string;
    }>
  ): string {
    const now = new Date();

    const formattedCalls = calls
      .map((call) => {
        const hoursAgo = Math.floor((now.getTime() - call.startedAt.getTime()) / (1000 * 60 * 60));
        const minutesAgo = Math.floor((now.getTime() - call.startedAt.getTime()) / (1000 * 60));

        let timeAgo: string;
        if (hoursAgo >= 1) {
          timeAgo = `il y a ${hoursAgo} heure${hoursAgo > 1 ? 's' : ''}`;
        } else {
          timeAgo = `il y a ${minutesAgo} minute${minutesAgo > 1 ? 's' : ''}`;
        }

        const complaint = call.chiefComplaint || 'Non spécifié';
        const priority = call.priority ? `Priorité ${call.priority}` : 'Priorité non définie';

        return `- ${timeAgo}: ${complaint} (${priority})`;
      })
      .join('\n');

    return `HISTORIQUE_PATIENT: Ce patient a contacté le SAMU dans les dernières 24 heures. Voici l'historique:\n${formattedCalls}\n\nTenez compte de ces appels précédents lors de votre évaluation.`;
  }

  /**
   * Send contextual update with exponential backoff retry
   * Needed because WebSocket connection might not be ready immediately after CallStartedEvent
   */
  private async sendContextualUpdateWithRetry(
    callId: string,
    message: string,
    attempt: number = 1
  ): Promise<boolean> {
    const success = twilioElevenLabsProxyService.sendContextualUpdate(callId, message);

    if (success) {
      logger.info('Contextual update sent successfully', { callId, attempt });
      return true;
    }

    // If failed and we have retries left
    if (attempt < this.MAX_RETRIES) {
      // Calculate delay with exponential backoff
      const delay = Math.min(this.INITIAL_DELAY_MS * Math.pow(2, attempt - 1), this.MAX_DELAY_MS);

      logger.info('WebSocket not ready, retrying contextual update', {
        callId,
        attempt,
        nextRetryIn: `${delay}ms`,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry
      return this.sendContextualUpdateWithRetry(callId, message, attempt + 1);
    }

    // Max retries reached
    logger.warn('Failed to send contextual update after max retries', {
      callId,
      maxRetries: this.MAX_RETRIES,
    });
    return false;
  }
}
