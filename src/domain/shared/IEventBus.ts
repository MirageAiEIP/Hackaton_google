import { DomainEvent } from './DomainEvent';

/**
 * Event Bus interface (Port)
 * Infrastructure layer will provide the implementation
 */
export interface IEventBus {
  /**
   * Publish an event to all subscribers
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Subscribe to an event type
   */
  subscribe(eventName: string, handler: IEventHandler): Promise<void>;
}

/**
 * Event Handler interface
 */
export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}
