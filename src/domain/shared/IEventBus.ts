import { DomainEvent } from './DomainEvent';

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;

  subscribe(eventName: string, handler: IEventHandler): Promise<void>;
}

export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}
