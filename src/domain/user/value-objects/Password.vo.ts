import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Password Value Object
 *
 * Encapsulates password hashing and validation logic
 */
export class Password {
  private readonly hashedValue: string;

  private constructor(hashedValue: string) {
    this.hashedValue = hashedValue;
  }

  /**
   * Create a Password from a plain text password
   * Automatically hashes the password
   */
  static async create(plainPassword: string): Promise<Password> {
    this.validatePassword(plainPassword);
    const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return new Password(hashed);
  }

  /**
   * Create a Password from an already hashed value
   * (e.g., from database)
   */
  static fromHash(hashedValue: string): Password {
    return new Password(hashedValue);
  }

  /**
   * Compare a plain password with the hashed password
   */
  async compare(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.hashedValue);
  }

  /**
   * Get the hashed password value
   */
  getValue(): string {
    return this.hashedValue;
  }

  /**
   * Validate password meets security requirements
   */
  private static validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }
}
