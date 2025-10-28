import { IEventHandler } from '@/domain/shared/IEventBus';
import { OperatorStatusChangedEvent } from '@/domain/operator/events/OperatorStatusChanged.event';
import { logger } from '@/utils/logger';
import { queueService } from '@/services/queue.service';
import { twilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';

/**
 * Event Handler: Notify ElevenLabs agents when an operator becomes available
 *
 * When an operator changes status to AVAILABLE:
 * 1. Get the first call in the queue
 * 2. Send a contextual update to the ElevenLabs agent handling that call
 * 3. The agent can then use the request_human_handoff tool to transfer the call
 */
export class OperatorAvailableHandler implements IEventHandler<OperatorStatusChangedEvent> {
  constructor() {}

  async handle(event: OperatorStatusChangedEvent): Promise<void> {
    logger.info('Handling OperatorStatusChanged event', {
      operatorId: event.operatorId,
      operatorEmail: event.operatorEmail,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      eventId: event.id,
    });

    // Only proceed if operator became available
    if (event.newStatus !== 'AVAILABLE') {
      logger.debug('Operator not available, skipping notification', {
        operatorId: event.operatorId,
        newStatus: event.newStatus,
      });
      return;
    }

    try {
      // Get the queue (sorted by priority and wait time)
      const queue = await queueService.listQueue({ status: 'WAITING' });

      if (!queue || queue.length === 0) {
        logger.info('No calls in queue, no notification needed', {
          operatorId: event.operatorId,
        });
        return;
      }

      // Get the first call in the queue (highest priority, longest wait)
      const firstQueueEntry = queue[0];

      if (!firstQueueEntry) {
        logger.warn('First queue entry is undefined', { operatorId: event.operatorId });
        return;
      }

      // Don't notify for P3 (non-urgent) calls
      if (firstQueueEntry.priority === 'P3') {
        logger.info(
          'First call in queue is P3 (non-urgent), skipping operator availability notification',
          {
            callId: firstQueueEntry.callId,
            queueEntryId: firstQueueEntry.id,
            priority: firstQueueEntry.priority,
            operatorId: event.operatorId,
          }
        );
        return;
      }

      logger.info('Notifying ElevenLabs agent about operator availability', {
        callId: firstQueueEntry.callId,
        queueEntryId: firstQueueEntry.id,
        priority: firstQueueEntry.priority,
        operatorId: event.operatorId,
        operatorEmail: event.operatorEmail,
      });

      // Send contextual update to the ElevenLabs agent
      const message = `OPERATOR_AVAILABLE: Un opérateur humain est maintenant disponible pour prendre cet appel. Si le patient souhaite parler à un opérateur ou si la situation nécessite une intervention humaine, utilisez immédiatement la fonction request_human_handoff.`;

      const success = twilioElevenLabsProxyService.sendContextualUpdate(
        firstQueueEntry.callId,
        message
      );

      if (success) {
        logger.info('Successfully notified ElevenLabs agent about operator availability', {
          callId: firstQueueEntry.callId,
          operatorId: event.operatorId,
        });
      } else {
        logger.warn('Failed to send contextual update - no active connection found', {
          callId: firstQueueEntry.callId,
          operatorId: event.operatorId,
        });
      }
    } catch (error) {
      logger.error('Failed to notify agent about operator availability', error as Error, {
        operatorId: event.operatorId,
        newStatus: event.newStatus,
      });
    }
  }
}
