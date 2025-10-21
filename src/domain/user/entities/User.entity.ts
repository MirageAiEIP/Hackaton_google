import { Password } from '@/domain/user/value-objects/Password.vo.js';

export enum Role {
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN',
}

export interface UserProps {
  id: string;
  employeeId: string;
  fullName: string;
  password: string; // Hashed
  role: Role;
  isActive: boolean;
  operatorId: string | null;
  createdBy: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProps {
  employeeId: string;
  fullName: string;
  password: string; // Hashed
  role: Role;
  createdBy?: string | null;
  operatorId?: string | null;
}

/**
 * User Entity
 *
 * Represents an authenticated user in the SAMU AI Triage system
 */
export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = { ...props };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.props.id;
  }

  get employeeId(): string {
    return this.props.employeeId;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get role(): Role {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get operatorId(): string | null {
    return this.props.operatorId;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Check if user is an admin
   */
  isAdmin(): boolean {
    return this.props.role === Role.ADMIN;
  }

  /**
   * Check if user is an operator
   */
  isOperator(): boolean {
    return this.props.role === Role.OPERATOR;
  }

  /**
   * Activate the user account
   */
  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Deactivate the user account
   */
  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /**
   * Validate password against stored hash
   */
  async validatePassword(plainPassword: string): Promise<boolean> {
    const passwordVO = Password.fromHash(this.props.password);
    return passwordVO.compare(plainPassword);
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<void> {
    const passwordVO = await Password.create(newPassword);
    this.props.password = passwordVO.getValue();
    this.props.updatedAt = new Date();
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.updatedAt = new Date();
  }

  /**
   * Update full name
   */
  updateFullName(fullName: string): void {
    if (!fullName || fullName.trim().length < 2) {
      throw new Error('Full name must be at least 2 characters');
    }
    this.props.fullName = fullName.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Update role
   */
  updateRole(role: Role): void {
    this.props.role = role;
    this.props.updatedAt = new Date();
  }

  /**
   * Link to operator profile
   */
  linkOperator(operatorId: string): void {
    this.props.operatorId = operatorId;
    this.props.updatedAt = new Date();
  }

  /**
   * Unlink from operator profile
   */
  unlinkOperator(): void {
    this.props.operatorId = null;
    this.props.updatedAt = new Date();
  }

  // ============================================================================
  // Data Mapping
  // ============================================================================

  /**
   * Convert to plain object (for persistence)
   */
  toObject(): UserProps {
    return { ...this.props };
  }

  /**
   * Convert to safe object (excluding password)
   */
  toSafeObject(): Omit<UserProps, 'password'> {
    const { password: _password, ...safeProps } = this.props;
    return safeProps;
  }

  /**
   * Create from plain object
   */
  static fromObject(props: UserProps): User {
    return new User(props);
  }
}
