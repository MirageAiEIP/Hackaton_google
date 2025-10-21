import { DomainEvent } from '@/domain/shared/DomainEvent.js';

export interface UserLoggedOutPayload {
  userId: string;
  employeeId: string;
  allDevices: boolean;
  timestamp: Date;
}

export class UserLoggedOut extends DomainEvent {
  public readonly userId: string;
  public readonly employeeId: string;
  public readonly allDevices: boolean;
  public readonly timestamp: Date;

  constructor(payload: UserLoggedOutPayload) {
    super('UserLoggedOut');
    this.userId = payload.userId;
    this.employeeId = payload.employeeId;
    this.allDevices = payload.allDevices;
    this.timestamp = payload.timestamp;
  }
}
