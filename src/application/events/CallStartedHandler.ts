import { IEventHandler } from '@/domain/shared/IEventBus';
import { CallStartedEvent } from '@/domain/triage/events/CallStarted.event';
import { logger } from '@/utils/logger';

/**
 * Handler for CallStarted event
 * Example: Enqueue background job for triage analysis
 */
export class CallStartedHandler implements IEventHandler<CallStartedEvent> {
  constructor() {} // private readonly triageQueue: Queue // TODO: Inject BullMQ queue when implemented

  async handle(event: CallStartedEvent): Promise<void> {
    logger.info('Handling CallStarted event', {
      callId: event.callId,
      eventId: event.id,
      correlationId: event.correlationId,
    });

    // Example actions when call starts:

    // 1. Enqueue background job for triage analysis (after call ends)
    // await this.triageQueue.add('analyze-call', {
    //   callId: event.callId
    // }, {
    //   delay: 0, // Process immediately after call ends
    //   attempts: 3,
    //   backoff: { type: 'exponential', delay: 2000 }
    // });

    // 2. Broadcast to WebSocket clients (real-time dashboard)
    // await this.wsGateway.broadcastNewCall({
    //   callId: event.callId,
    //   startedAt: event.occurredAt
    // });

    // 3. Create audit log entry (GDPR compliance)
    // await this.auditLog.log('CALL_STARTED', {
    //   callId: event.callId,
    //   timestamp: event.occurredAt
    // });

    logger.debug('CallStarted event handled successfully', {
      callId: event.callId,
      eventId: event.id,
    });
  }
}
