import { DomainEvent } from '@/domain/shared/DomainEvent.js';

export interface UserLoggedInPayload {
  userId: string;
  employeeId: string;
  role: 'OPERATOR' | 'ADMIN';
  timestamp: Date;
}

export class UserLoggedIn extends DomainEvent {
  public readonly userId: string;
  public readonly employeeId: string;
  public readonly role: 'OPERATOR' | 'ADMIN';
  public readonly timestamp: Date;

  constructor(payload: UserLoggedInPayload) {
    super('UserLoggedIn');
    this.userId = payload.userId;
    this.employeeId = payload.employeeId;
    this.role = payload.role;
    this.timestamp = payload.timestamp;
  }
}
