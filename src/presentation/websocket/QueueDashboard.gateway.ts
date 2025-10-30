import type { WebSocket } from '@fastify/websocket';
import type { IncomingMessage } from 'http';
import WS from 'ws';
import { logger } from '@/utils/logger';
import { queueService } from '@/services/queue.service';
import { callService } from '@/services/call.service';
import { loadConfig } from '@/config/index.async';
import { verifyAccessTokenFromQuery } from '@/infrastructure/auth/jwt.util';
import {
  QueueOutgoingMessage,
  QueueIncomingMessage,
  QueueEntryData,
  QueueUpdateData,
} from '@/types/websocket.types';
import { Container } from '@/infrastructure/di/Container';
import { QueueEntryAddedEvent } from '@/domain/triage/events/QueueEntryAdded.event';
import { QueueEntryStatusChangedEvent } from '@/domain/triage/events/QueueEntryStatusChanged.event';
import { QueueStatus } from '@prisma/client';

interface AuthenticatedConnection {
  socket: WebSocket;
  userId: string;
  role: 'OPERATOR' | 'ADMIN';
  operatorId: string | null;
  connectedAt: Date;
  subscribedToCallId: string | null; // Track which call transcript the client is subscribed to
}

export class QueueDashboardGateway {
  private connections: Map<string, AuthenticatedConnection> = new Map();
  private pingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private jwtAccessSecret: string = '';

  constructor() {}

  async initialize(): Promise<void> {
    try {
      const config = await loadConfig();
      this.jwtAccessSecret = config.jwt.accessTokenSecret;

      // Subscribe to queue events from EventBus
      const container = Container.getInstance();
      const eventBus = container.getEventBus();

      await eventBus.subscribe('QueueEntryAddedEvent', {
        handle: async (event) => {
          await this.handleQueueEntryAdded(event as QueueEntryAddedEvent);
        },
      });
      await eventBus.subscribe('QueueEntryStatusChangedEvent', {
        handle: async (event) => {
          await this.handleQueueEntryStatusChanged(event as QueueEntryStatusChangedEvent);
        },
      });

      logger.info('QueueDashboardGateway initialized', {
        connectedClients: this.connections.size,
      });
    } catch (error) {
      logger.error('Failed to initialize QueueDashboardGateway', error as Error);
      throw error;
    }
  }

  async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = this.generateConnectionId();

    try {
      // Extract token from query parameter
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || undefined;

      // Verify JWT and check role
      const decoded = verifyAccessTokenFromQuery(token, this.jwtAccessSecret, [
        'OPERATOR',
        'ADMIN',
      ]);

      // Create authenticated connection
      const connection: AuthenticatedConnection = {
        socket,
        userId: decoded.userId,
        role: decoded.role,
        operatorId: decoded.operatorId,
        connectedAt: new Date(),
        subscribedToCallId: null,
      };

      this.connections.set(connectionId, connection);

      logger.info('Queue dashboard client connected', {
        connectionId,
        userId: decoded.userId,
        role: decoded.role,
        totalConnections: this.connections.size,
      });

      // Send initial queue snapshot
      await this.sendInitialSnapshot(socket);

      // Start ping/pong heartbeat
      this.startHeartbeat(connectionId, socket);

      // Handle incoming messages
      socket.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data, connection);
      });

      // Handle disconnection
      socket.on('close', () => {
        this.handleDisconnection(connectionId);
      });

      socket.on('error', (error) => {
        logger.error('Queue dashboard WebSocket error', error, { connectionId });
        this.handleDisconnection(connectionId);
      });
    } catch (error) {
      logger.error('Queue dashboard authentication failed', error as Error, { connectionId });

      // Send error and close connection
      this.sendError(socket, 'AUTHENTICATION_FAILED', (error as Error).message);
      socket.close();
    }
  }

  private async sendInitialSnapshot(socket: WebSocket): Promise<void> {
    try {
      // Get active queue entries (WAITING, CLAIMED, IN_PROGRESS)
      const queueEntries = await queueService.listQueue();

      const activeEntries = queueEntries.filter((entry) =>
        ['WAITING', 'CLAIMED', 'IN_PROGRESS'].includes(entry.status)
      );

      const data: QueueEntryData[] = activeEntries.map((entry) => ({
        id: entry.id,
        callId: entry.callId,
        priority: entry.priority,
        chiefComplaint: entry.chiefComplaint,
        patientAge: entry.patientAge,
        patientGender: entry.patientGender,
        location: entry.location,
        aiSummary: entry.aiSummary,
        aiRecommendation: entry.aiRecommendation,
        keySymptoms: entry.keySymptoms,
        redFlags: entry.redFlags,
        status: entry.status,
        waitingSince: entry.waitingSince.toISOString(),
        waitingTimeSeconds: Math.floor((Date.now() - entry.waitingSince.getTime()) / 1000),
        claimedBy: entry.claimedBy,
        claimedAt: entry.claimedAt?.toISOString() || null,
        conversationId: entry.conversationId,
      }));

      const message: QueueOutgoingMessage = {
        type: 'queue:initial',
        data,
      };

      this.sendMessage(socket, message);

      logger.info('Sent initial queue snapshot', {
        entriesCount: data.length,
      });
    } catch (error) {
      logger.error('Failed to send initial snapshot', error as Error);
      this.sendError(socket, 'SNAPSHOT_FAILED', 'Failed to load queue data');
    }
  }

  private async handleQueueEntryAdded(event: QueueEntryAddedEvent): Promise<void> {
    try {
      const queueEntry = await queueService.getQueueEntryById(event.queueEntryId);

      const data: QueueEntryData = {
        id: queueEntry.id,
        callId: queueEntry.callId,
        priority: queueEntry.priority,
        chiefComplaint: queueEntry.chiefComplaint,
        patientAge: queueEntry.patientAge,
        patientGender: queueEntry.patientGender,
        location: queueEntry.location,
        aiSummary: queueEntry.aiSummary,
        aiRecommendation: queueEntry.aiRecommendation,
        keySymptoms: queueEntry.keySymptoms,
        redFlags: queueEntry.redFlags,
        status: queueEntry.status,
        waitingSince: queueEntry.waitingSince.toISOString(),
        waitingTimeSeconds: Math.floor((Date.now() - queueEntry.waitingSince.getTime()) / 1000),
        claimedBy: queueEntry.claimedBy,
        claimedAt: queueEntry.claimedAt?.toISOString() || null,
        conversationId: queueEntry.conversationId,
      };

      const message: QueueOutgoingMessage = {
        type: 'queue:added',
        data,
      };

      this.broadcastToAll(message);

      logger.info('Broadcasted queue entry added', {
        queueEntryId: event.queueEntryId,
        priority: event.priority,
      });
    } catch (error) {
      logger.error('Failed to handle queue entry added event', error as Error, {
        queueEntryId: event.queueEntryId,
      });
    }
  }

  private async handleQueueEntryStatusChanged(event: QueueEntryStatusChangedEvent): Promise<void> {
    try {
      const queueEntry = await queueService.getQueueEntryById(event.queueEntryId);

      // If status is COMPLETED or ABANDONED, send remove message
      if (event.newStatus === 'COMPLETED' || event.newStatus === 'ABANDONED') {
        const message: QueueOutgoingMessage = {
          type: 'queue:removed',
          data: {
            id: event.queueEntryId,
          },
        };

        this.broadcastToAll(message);

        logger.info('Broadcasted queue entry removed', {
          queueEntryId: event.queueEntryId,
          status: event.newStatus,
        });
      } else {
        // Otherwise send update
        const data: QueueUpdateData = {
          id: queueEntry.id,
          status: queueEntry.status as QueueStatus,
          claimedBy: queueEntry.claimedBy,
          claimedAt: queueEntry.claimedAt?.toISOString() || null,
          waitingTimeSeconds: Math.floor((Date.now() - queueEntry.waitingSince.getTime()) / 1000),
        };

        const message: QueueOutgoingMessage = {
          type: 'queue:updated',
          data,
        };

        this.broadcastToAll(message);

        logger.info('Broadcasted queue entry updated', {
          queueEntryId: event.queueEntryId,
          oldStatus: event.previousStatus,
          newStatus: event.newStatus,
        });
      }
    } catch (error) {
      logger.error('Failed to handle queue entry status changed event', error as Error, {
        queueEntryId: event.queueEntryId,
      });
    }
  }

  private async handleMessage(
    connectionId: string,
    data: Buffer,
    connection: AuthenticatedConnection
  ): Promise<void> {
    try {
      const message: QueueIncomingMessage = JSON.parse(data.toString());

      // IMPORTANT: Get connection from map to ensure we modify the right object
      const storedConnection = this.connections.get(connectionId);
      if (!storedConnection) {
        logger.warn('Connection not found in map', { connectionId });
        return;
      }

      switch (message.type) {
        case 'queue:ping':
          // Respond to ping with pong
          this.sendMessage(connection.socket, {
            type: 'queue:pong',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'queue:subscribe':
          // Client requests to re-subscribe (after reconnection)
          await this.sendInitialSnapshot(connection.socket);
          break;

        case 'queue:subscribe-transcript':
          // Client wants to receive transcript updates for a specific call
          // IMPORTANT: Modify the stored connection object, not the parameter
          storedConnection.subscribedToCallId = message.callId;
          logger.info('Client subscribed to transcript updates', {
            connectionId,
            callId: message.callId,
            verified: storedConnection.subscribedToCallId === message.callId,
          });

          // Send current transcript immediately
          await this.sendCurrentTranscript(connection.socket, message.callId);
          break;

        case 'queue:unsubscribe-transcript':
          // Client no longer wants transcript updates
          storedConnection.subscribedToCallId = null;
          logger.info('Client unsubscribed from transcript updates', {
            connectionId,
            callId: message.callId,
          });
          break;

        default:
          logger.warn('Unknown message type received', {
            connectionId,
            type: (message as { type: string }).type,
          });
      }
    } catch (error) {
      logger.error('Failed to handle incoming message', error as Error, { connectionId });
    }
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info('Queue dashboard client disconnected', {
        connectionId,
        userId: connection.userId,
        role: connection.role,
        connectedDuration: Date.now() - connection.connectedAt.getTime(),
      });

      // Stop heartbeat
      const interval = this.pingIntervals.get(connectionId);
      if (interval) {
        clearInterval(interval);
        this.pingIntervals.delete(connectionId);
      }

      this.connections.delete(connectionId);
    }
  }

  private startHeartbeat(connectionId: string, socket: WebSocket): void {
    const interval = setInterval(() => {
      if (socket.readyState === WS.OPEN) {
        this.sendMessage(socket, {
          type: 'queue:pong',
          timestamp: new Date().toISOString(),
        });
      }
    }, 30000);

    this.pingIntervals.set(connectionId, interval);
  }

  private sendMessage(socket: WebSocket, message: QueueOutgoingMessage): void {
    if (socket.readyState === WS.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private sendError(socket: WebSocket, code: string, message: string): void {
    if (socket.readyState === WS.OPEN) {
      const errorMessage: QueueOutgoingMessage = {
        type: 'queue:error',
        error: { code, message },
      };
      socket.send(JSON.stringify(errorMessage));
    }
  }

  private broadcastToAll(message: QueueOutgoingMessage): void {
    let sent = 0;
    for (const connection of this.connections.values()) {
      this.sendMessage(connection.socket, message);
      sent++;
    }

    logger.debug('Broadcasted message to all clients', {
      messageType: message.type,
      clientsSent: sent,
    });
  }

  public broadcastTranscriptUpdate(callId: string, transcript: string): void {
    const message: QueueOutgoingMessage = {
      type: 'queue:transcript-updated',
      data: {
        callId,
        transcript,
        lastUpdate: new Date().toISOString(),
      },
    };

    let sent = 0;
    const subscriptions: string[] = [];
    for (const connection of this.connections.values()) {
      subscriptions.push(connection.subscribedToCallId || 'null');
      if (connection.subscribedToCallId === callId) {
        this.sendMessage(connection.socket, message);
        sent++;
      }
    }

    logger.info('Broadcasted transcript update', {
      callId,
      clientsSent: sent,
      totalConnections: this.connections.size,
      subscriptions: subscriptions,
    });
  }

  private async sendCurrentTranscript(socket: WebSocket, callId: string): Promise<void> {
    try {
      const call = await callService.getCallById(callId);

      if (!call) {
        logger.warn('Call not found for transcript subscription', { callId });
        this.sendError(socket, 'CALL_NOT_FOUND', `Call ${callId} not found`);
        return;
      }

      const message: QueueOutgoingMessage = {
        type: 'queue:transcript-updated',
        data: {
          callId,
          transcript: call.transcript || '',
          lastUpdate: new Date().toISOString(),
        },
      };

      this.sendMessage(socket, message);

      logger.debug('Sent current transcript to client', {
        callId,
        transcriptLength: call.transcript?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to send current transcript', error as Error, { callId });
      this.sendError(socket, 'TRANSCRIPT_FETCH_FAILED', 'Failed to fetch transcript');
    }
  }

  private generateConnectionId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): {
    totalConnections: number;
    connectionsByRole: Record<string, number>;
  } {
    const connectionsByRole: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      connectionsByRole[connection.role] = (connectionsByRole[connection.role] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByRole,
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down QueueDashboardGateway', {
      activeConnections: this.connections.size,
    });

    // Clear all intervals
    for (const interval of this.pingIntervals.values()) {
      clearInterval(interval);
    }
    this.pingIntervals.clear();

    for (const connection of this.connections.values()) {
      if (connection.socket.readyState === WS.OPEN) {
        connection.socket.close();
      }
    }
    this.connections.clear();

    logger.info('QueueDashboardGateway shut down successfully');
  }
}

// Singleton instance for broadcast from services
export const queueDashboardGateway = new QueueDashboardGateway();
