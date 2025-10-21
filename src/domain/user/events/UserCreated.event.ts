import { DomainEvent } from '@/domain/shared/DomainEvent.js';

export interface UserCreatedPayload {
  userId: string;
  employeeId: string;
  fullName: string;
  role: 'OPERATOR' | 'ADMIN';
  createdBy: string | null;
}

export class UserCreated extends DomainEvent {
  public readonly userId: string;
  public readonly employeeId: string;
  public readonly fullName: string;
  public readonly role: 'OPERATOR' | 'ADMIN';
  public readonly createdBy: string | null;

  constructor(payload: UserCreatedPayload) {
    super('UserCreated');
    this.userId = payload.userId;
    this.employeeId = payload.employeeId;
    this.fullName = payload.fullName;
    this.role = payload.role;
    this.createdBy = payload.createdBy;
  }
}
