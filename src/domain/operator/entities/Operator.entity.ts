export enum OperatorStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
  ON_BREAK = 'ON_BREAK',
}

export interface OperatorProps {
  id: string;
  email: string;
  name: string;
  role: string;
  status: OperatorStatus;
  lastActiveAt?: Date;
  totalCallsHandled: number;
  averageHandleTime: number;
  currentCallId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Operator {
  private props: OperatorProps;

  constructor(props: OperatorProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }

  get role(): string {
    return this.props.role;
  }

  get status(): OperatorStatus {
    return this.props.status;
  }

  get lastActiveAt(): Date | undefined {
    return this.props.lastActiveAt;
  }

  get totalCallsHandled(): number {
    return this.props.totalCallsHandled;
  }

  get averageHandleTime(): number {
    return this.props.averageHandleTime;
  }

  get currentCallId(): string | undefined {
    return this.props.currentCallId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isAvailable(): boolean {
    return this.props.status === OperatorStatus.AVAILABLE && !this.props.currentCallId;
  }

  setAvailable(): void {
    this.props.status = OperatorStatus.AVAILABLE;
    this.props.lastActiveAt = new Date();
    this.props.updatedAt = new Date();
  }

  setBusy(callId: string): void {
    if (!this.isAvailable()) {
      throw new Error('Operator is not available');
    }
    this.props.status = OperatorStatus.BUSY;
    this.props.currentCallId = callId;
    this.props.lastActiveAt = new Date();
    this.props.updatedAt = new Date();
  }

  setOffline(): void {
    this.props.status = OperatorStatus.OFFLINE;
    this.props.currentCallId = undefined;
    this.props.updatedAt = new Date();
  }

  completeCall(handleTime: number): void {
    if (!this.props.currentCallId) {
      throw new Error('Operator has no active call');
    }

    // Update stats
    const totalTime = this.props.averageHandleTime * this.props.totalCallsHandled + handleTime;
    this.props.totalCallsHandled += 1;
    this.props.averageHandleTime = Math.round(totalTime / this.props.totalCallsHandled);

    // Reset state
    this.props.currentCallId = undefined;
    this.props.status = OperatorStatus.AVAILABLE;
    this.props.lastActiveAt = new Date();
    this.props.updatedAt = new Date();
  }

  toObject(): OperatorProps {
    return { ...this.props };
  }
}
