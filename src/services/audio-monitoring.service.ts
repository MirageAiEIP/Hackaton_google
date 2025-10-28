import { logger } from '@/utils/logger';
import type { WebSocket } from 'ws';

/**
 * Types for audio monitoring
 */
export interface TwilioStreamMessage {
  event: 'start' | 'media' | 'stop';
  streamSid?: string;
  callSid?: string;
  track?: 'inbound' | 'outbound';
  media?: {
    payload: string; // base64 encoded audio
    timestamp: string;
    track: 'inbound' | 'outbound';
  };
}

export interface OperatorConnection {
  operatorId: string;
  websocket: WebSocket;
  connectedAt: Date;
  filters?: {
    includeInbound?: boolean;
    includeOutbound?: boolean;
  };
}

export interface ActiveCallStream {
  callSid: string;
  streamSid: string;
  twilioWebSocket?: WebSocket;
  operators: Map<string, OperatorConnection>;
  startedAt: Date;
  metadata?: {
    from?: string;
    to?: string;
  };
}

/**
 * Service for managing real-time audio monitoring
 * Relays Twilio audio streams to operator dashboard connections
 */
export class AudioMonitoringService {
  // Map of CallSid -> ActiveCallStream
  private activeStreams: Map<string, ActiveCallStream> = new Map();

  /**
   * Register a new Twilio audio stream
   */
  registerTwilioStream(
    callSid: string,
    streamSid: string,
    metadata?: { from?: string; to?: string }
  ): void {
    if (this.activeStreams.has(callSid)) {
      logger.warn('Call already has an active stream, replacing', { callSid, streamSid });
    }

    this.activeStreams.set(callSid, {
      callSid,
      streamSid,
      operators: new Map(),
      startedAt: new Date(),
      metadata,
    });

    logger.info('Twilio stream registered', { callSid, streamSid, metadata });
  }

  /**
   * Handle incoming Twilio WebSocket connection
   */
  handleTwilioConnection(callSid: string, ws: WebSocket): void {
    const stream = this.activeStreams.get(callSid);
    if (!stream) {
      logger.error('No stream registered for call', undefined, { callSid });
      ws.close(1008, 'No stream registered for this call');
      return;
    }

    stream.twilioWebSocket = ws;
    logger.info('Twilio WebSocket connected', { callSid, streamSid: stream.streamSid });

    ws.on('message', (message: string) => {
      try {
        const data: TwilioStreamMessage = JSON.parse(message);
        this.handleTwilioMessage(callSid, data);
      } catch (error) {
        logger.error('Failed to parse Twilio message', error as Error, { callSid });
      }
    });

    ws.on('close', () => {
      logger.info('Twilio WebSocket closed', { callSid });
      this.cleanupStream(callSid);
    });

    ws.on('error', (error) => {
      logger.error('Twilio WebSocket error', error, { callSid });
    });
  }

  /**
   * Handle Twilio stream messages and relay to operators
   */
  private handleTwilioMessage(callSid: string, message: TwilioStreamMessage): void {
    const stream = this.activeStreams.get(callSid);
    if (!stream) {
      return;
    }

    // Handle different event types
    switch (message.event) {
      case 'start':
        logger.info('Twilio stream started', {
          callSid,
          streamSid: message.streamSid,
          track: message.track,
        });
        break;

      case 'media':
        // Relay audio to all connected operators
        this.relayAudioToOperators(callSid, message);
        break;

      case 'stop':
        logger.info('Twilio stream stopped', { callSid, streamSid: message.streamSid });
        this.cleanupStream(callSid);
        break;
    }
  }

  /**
   * Handle Twilio message from external source (e.g., proxy service)
   */
  handleTwilioMessageFromProxy(callSid: string, message: TwilioStreamMessage): void {
    this.handleTwilioMessage(callSid, message);
  }

  /**
   * Relay audio payload to all operators monitoring this call
   */
  private relayAudioToOperators(callSid: string, message: TwilioStreamMessage): void {
    const stream = this.activeStreams.get(callSid);
    if (!stream || !message.media) {
      return;
    }

    const track = message.media.track;
    let relayCount = 0;

    // Send to each connected operator
    stream.operators.forEach((operator, operatorId) => {
      try {
        // Check if operator wants this track (inbound/outbound filtering)
        const filters = operator.filters;
        if (filters) {
          if (track === 'inbound' && filters.includeInbound === false) {
            return;
          }
          if (track === 'outbound' && filters.includeOutbound === false) {
            return;
          }
        }

        // Send audio payload
        if (operator.websocket.readyState === 1) {
          // OPEN
          operator.websocket.send(
            JSON.stringify({
              type: 'audio',
              callSid,
              track,
              payload: message.media?.payload,
              timestamp: message.media?.timestamp,
            })
          );
          relayCount++;
        } else {
          logger.warn('Operator WebSocket not ready, skipping', {
            operatorId,
            readyState: operator.websocket.readyState,
          });
        }
      } catch (error) {
        logger.error('Failed to relay audio to operator', error as Error, {
          operatorId,
          callSid,
        });
        // Remove broken connection
        this.removeOperator(callSid, operatorId);
      }
    });

    if (relayCount > 0) {
      logger.debug('Audio relayed to operators', { callSid, track, operatorCount: relayCount });
    }
  }

  /**
   * Register an operator connection to monitor a specific call
   */
  addOperator(
    callSid: string,
    operatorId: string,
    websocket: WebSocket,
    filters?: { includeInbound?: boolean; includeOutbound?: boolean }
  ): boolean {
    const stream = this.activeStreams.get(callSid);
    if (!stream) {
      logger.error('Cannot add operator: stream not found', undefined, { callSid, operatorId });
      return false;
    }

    // Check if operator already connected
    if (stream.operators.has(operatorId)) {
      logger.warn('Operator already monitoring this call, replacing connection', {
        callSid,
        operatorId,
      });
      this.removeOperator(callSid, operatorId);
    }

    const connection: OperatorConnection = {
      operatorId,
      websocket,
      connectedAt: new Date(),
      filters: filters || { includeInbound: true, includeOutbound: true },
    };

    stream.operators.set(operatorId, connection);

    logger.info('Operator added to stream monitoring', {
      callSid,
      operatorId,
      operatorCount: stream.operators.size,
      filters: connection.filters,
    });

    // Send initial metadata
    websocket.send(
      JSON.stringify({
        type: 'connected',
        callSid,
        streamSid: stream.streamSid,
        metadata: stream.metadata,
        connectedAt: connection.connectedAt,
      })
    );

    // Handle operator disconnection
    websocket.on('close', () => {
      logger.info('Operator WebSocket closed', { callSid, operatorId });
      this.removeOperator(callSid, operatorId);
    });

    websocket.on('error', (error) => {
      logger.error('Operator WebSocket error', error, { callSid, operatorId });
      this.removeOperator(callSid, operatorId);
    });

    return true;
  }

  /**
   * Remove an operator from monitoring a call
   */
  removeOperator(callSid: string, operatorId: string): void {
    const stream = this.activeStreams.get(callSid);
    if (!stream) {
      return;
    }

    const removed = stream.operators.delete(operatorId);
    if (removed) {
      logger.info('Operator removed from stream monitoring', {
        callSid,
        operatorId,
        remainingOperators: stream.operators.size,
      });
    }
  }

  /**
   * Clean up a stream when the call ends
   */
  private cleanupStream(callSid: string): void {
    const stream = this.activeStreams.get(callSid);
    if (!stream) {
      return;
    }

    // Notify all operators that the call has ended
    stream.operators.forEach((operator, operatorId) => {
      try {
        if (operator.websocket.readyState === 1) {
          operator.websocket.send(
            JSON.stringify({
              type: 'call_ended',
              callSid,
            })
          );
        }
        operator.websocket.close(1000, 'Call ended');
      } catch (error) {
        logger.error('Failed to notify operator of call end', error as Error, {
          operatorId,
          callSid,
        });
      }
    });

    // Close Twilio WebSocket if still open
    if (stream.twilioWebSocket && stream.twilioWebSocket.readyState === 1) {
      stream.twilioWebSocket.close(1000, 'Stream cleanup');
    }

    this.activeStreams.delete(callSid);
    logger.info('Stream cleaned up', { callSid, operatorCount: stream.operators.size });
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): Map<string, ActiveCallStream> {
    return this.activeStreams;
  }

  /**
   * Get stream info for a specific call
   */
  getStreamInfo(callSid: string): ActiveCallStream | undefined {
    return this.activeStreams.get(callSid);
  }

  /**
   * Get list of all calls available for monitoring
   */
  getMonitorableCalls(): Array<{
    callSid: string;
    streamSid: string;
    startedAt: Date;
    operatorCount: number;
    metadata?: { from?: string; to?: string };
  }> {
    const calls: Array<{
      callSid: string;
      streamSid: string;
      startedAt: Date;
      operatorCount: number;
      metadata?: { from?: string; to?: string };
    }> = [];

    this.activeStreams.forEach((stream) => {
      calls.push({
        callSid: stream.callSid,
        streamSid: stream.streamSid,
        startedAt: stream.startedAt,
        operatorCount: stream.operators.size,
        metadata: stream.metadata,
      });
    });

    return calls.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Force cleanup all streams (useful for shutdown)
   */
  cleanupAll(): void {
    const callSids = Array.from(this.activeStreams.keys());
    callSids.forEach((callSid) => this.cleanupStream(callSid));
    logger.info('All streams cleaned up', { count: callSids.length });
  }
}

export const audioMonitoringService = new AudioMonitoringService();
