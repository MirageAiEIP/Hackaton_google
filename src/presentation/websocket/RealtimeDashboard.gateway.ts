import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import { logger } from '@/utils/logger';
import { Container } from '@/infrastructure/di/Container';
import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * Real-Time Dashboard WebSocket Gateway
 * Broadcasts domain events to connected dashboard clients
 *
 * Rooms:
 * - dispatches: Ambulance dispatch updates (map markers)
 * - queue: Call queue updates (pending calls)
 * - operators: Operator status updates (availability)
 * - all: Broadcast to all connected clients
 */

interface WebSocketClient {
  id: string;
  socket: WebSocket;
  rooms: Set<string>;
  connectedAt: Date;
  userId?: string; // operator ID or doctor ID
  userRole?: 'operator' | 'doctor' | 'admin';
}

interface IEventHandler {
  handle(event: DomainEvent): Promise<void>;
}

interface ClientMessage {
  type: string;
  room?: string;
  userId?: string;
  userRole?: 'operator' | 'doctor' | 'admin';
}

type BroadcastEvent = DomainEvent | { type: string; [key: string]: unknown };

export class RealtimeDashboardGateway {
  private clients: Map<string, WebSocketClient> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map();

  constructor(private readonly app: FastifyInstance) {}

  /**
   * Initialize WebSocket gateway
   * Subscribes to Redis events for horizontal scaling
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Real-Time Dashboard Gateway');

    // Register WebSocket route
    this.app.get('/ws/dashboard', { websocket: true }, (socket, request) => {
      this.handleConnection(socket, request);
    });

    // Subscribe to domain events via Redis Pub/Sub
    const container = Container.getInstance();
    const eventBus = container.getEventBus();

    // Subscribe to key events for dashboard

    // QUEUE ROOM - Call lifecycle & queue management
    await eventBus.subscribe('CallStartedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('CallCompletedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('CallEscalatedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('CallCancelledEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('CallClaimedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('QueueEntryAddedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('QueueEntryStatusChangedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('HandoffRequestedEvent', this.createEventHandler('queue'));
    await eventBus.subscribe('HandoffAcceptedEvent', this.createEventHandler('queue'));

    // OPERATORS ROOM - Operator status changes
    await eventBus.subscribe('OperatorStatusChangedEvent', this.createEventHandler('operators'));

    // DISPATCHES ROOM - SMUR dispatch & ambulance tracking
    await eventBus.subscribe('DispatchCreatedEvent', this.createEventHandler('dispatches'));
    await eventBus.subscribe('DispatchStatusChangedEvent', this.createEventHandler('dispatches'));

    logger.info('Real-Time Dashboard Gateway initialized', {
      rooms: ['dispatches', 'queue', 'operators', 'all'],
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: FastifyRequest): void {
    const clientId = this.generateClientId();

    const client: WebSocketClient = {
      id: clientId,
      socket,
      rooms: new Set(['all']), // Default room
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);
    logger.info('Client connected to dashboard', {
      clientId: clientId.substring(0, 8) + '***',
      ip: request.ip,
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'connection',
      message: 'Connected to SAMU Real-Time Dashboard',
      clientId,
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages (room subscription, auth, etc.)
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', error as Error, { clientId });
      }
    });

    // Handle disconnection
    socket.on('close', () => {
      this.handleDisconnection(client);
    });

    socket.on('error', (error: Error) => {
      logger.error('WebSocket error', error, { clientId });
      this.handleDisconnection(client);
    });
  }

  /**
   * Handle client messages (subscribe, unsubscribe, ping)
   */
  private handleClientMessage(client: WebSocketClient, message: unknown): void {
    // Type guard to ensure message has the expected structure
    if (typeof message !== 'object' || message === null) {
      logger.warn('Invalid message received', { clientId: client.id });
      return;
    }

    const { type, room, userId, userRole } = message as ClientMessage;

    switch (type) {
      case 'subscribe':
        if (room && this.isValidRoom(room)) {
          this.subscribeToRoom(client, room);
          logger.info('Client subscribed to room', {
            clientId: client.id.substring(0, 8) + '***',
            room,
          });
        }
        break;

      case 'unsubscribe':
        if (room) {
          this.unsubscribeFromRoom(client, room);
          logger.info('Client unsubscribed from room', {
            clientId: client.id.substring(0, 8) + '***',
            room,
          });
        }
        break;

      case 'authenticate':
        client.userId = userId;
        client.userRole = userRole;
        logger.info('Client authenticated', {
          clientId: client.id.substring(0, 8) + '***',
          userId: userId?.substring(0, 8) + '***',
          userRole,
        });
        this.sendToClient(client, {
          type: 'authenticated',
          userId,
          userRole,
          timestamp: new Date().toISOString(),
        });
        break;

      case 'ping':
        this.sendToClient(client, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        logger.warn('Unknown message type', { type, clientId: client.id });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(client: WebSocketClient): void {
    // Remove from all rooms
    client.rooms.forEach((room) => {
      const roomClients = this.roomSubscriptions.get(room);
      if (roomClients) {
        roomClients.delete(client.id);
      }
    });

    this.clients.delete(client.id);
    logger.info('Client disconnected from dashboard', {
      clientId: client.id.substring(0, 8) + '***',
      duration: Date.now() - client.connectedAt.getTime(),
    });
  }

  /**
   * Subscribe client to room
   */
  private subscribeToRoom(client: WebSocketClient, room: string): void {
    client.rooms.add(room);

    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room)?.add(client.id);

    this.sendToClient(client, {
      type: 'subscribed',
      room,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe client from room
   */
  private unsubscribeFromRoom(client: WebSocketClient, room: string): void {
    client.rooms.delete(room);
    this.roomSubscriptions.get(room)?.delete(client.id);

    this.sendToClient(client, {
      type: 'unsubscribed',
      room,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast event to room
   */
  public broadcastToRoom(room: string, event: BroadcastEvent): void {
    const roomClients = this.roomSubscriptions.get(room);
    if (!roomClients || roomClients.size === 0) {
      const eventName =
        'eventName' in event ? event.eventName : 'type' in event ? event.type : 'unknown';
      logger.warn('📭 No clients subscribed to room', {
        room,
        event: eventName,
      });
      return;
    }

    const message = {
      type: 'event',
      room,
      event,
      timestamp: new Date().toISOString(),
    };

    let successCount = 0;
    let failureCount = 0;

    roomClients.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          this.sendToClient(client, message);
          successCount++;
        } catch (error) {
          failureCount++;
          logger.error('Failed to send to client', error as Error, { clientId });
        }
      }
    });

    const eventType =
      'eventName' in event ? event.eventName : 'type' in event ? event.type : 'unknown';
    logger.debug('Broadcast to room', {
      room,
      eventType,
      successCount,
      failureCount,
    });
  }

  /**
   * Broadcast to all connected clients
   */
  public broadcastToAll(event: BroadcastEvent): void {
    this.broadcastToRoom('all', event);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocketClient, message: unknown): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Create event handler that broadcasts to room
   */
  private createEventHandler(room: string): IEventHandler {
    return {
      handle: async (event: DomainEvent) => {
        logger.info('🔔 Dashboard gateway received event', {
          eventName: event.eventName,
          room,
          subscriberCount: this.roomSubscriptions.get(room)?.size || 0,
          totalConnectedClients: this.clients.size,
        });

        this.broadcastToRoom(room, {
          type: 'domain_event',
          eventName: event.eventName,
          eventId: event.id,
          occurredAt: event.occurredAt,
          data: event,
        });
      },
    };
  }

  /**
   * Validate room name
   */
  private isValidRoom(room: string): boolean {
    const validRooms = ['dispatches', 'queue', 'operators', 'all'];
    return validRooms.includes(room);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get gateway statistics
   */
  public getStats() {
    return {
      connectedClients: this.clients.size,
      rooms: Array.from(this.roomSubscriptions.entries()).map(([room, clients]) => ({
        room,
        clients: clients.size,
      })),
    };
  }

  /**
   * Shutdown gateway
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Real-Time Dashboard Gateway');

    // Close all client connections
    this.clients.forEach((client) => {
      try {
        client.socket.close();
      } catch (error) {
        logger.error('Error closing client socket', error as Error);
      }
    });

    this.clients.clear();
    this.roomSubscriptions.clear();

    logger.info('Real-Time Dashboard Gateway shut down');
  }
}
