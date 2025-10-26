import { IEventHandler } from '@/domain/shared/IEventBus';
import { CallStartedEvent } from '@/domain/triage/events/CallStarted.event';
import { logger } from '@/utils/logger';
import { queueService } from '@/services/queue.service';
import { callService } from '@/services/call.service';

export class CallStartedHandler implements IEventHandler<CallStartedEvent> {
  constructor() {}

  async handle(event: CallStartedEvent): Promise<void> {
    logger.info('Handling CallStarted event', {
      callId: event.callId,
      eventId: event.id,
    });

    try {
      const call = await callService.getCallById(event.callId);

      if (!call) {
        logger.warn('Call not found', { callId: event.callId });
        return;
      }

      await queueService.addToQueue({
        callId: event.callId,
        priority: 'P3',
        chiefComplaint: call.chiefComplaint || 'En cours de collecte...',
        patientAge: undefined,
        patientGender: undefined,
        location: undefined,
        aiSummary: 'Appel en cours - En attente de triage',
        aiRecommendation: 'Triage automatique en cours',
        keySymptoms: [],
        redFlags: [],
        conversationId: undefined,
      });

      logger.info('Call automatically added to queue', {
        callId: event.callId,
      });
    } catch (error) {
      logger.error('Failed to add call to queue', error as Error, {
        callId: event.callId,
      });
    }
  }
}
