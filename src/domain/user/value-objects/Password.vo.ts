import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export class Password {
  private readonly hashedValue: string;

  private constructor(hashedValue: string) {
    this.hashedValue = hashedValue;
  }

  static async create(plainPassword: string): Promise<Password> {
    this.validatePassword(plainPassword);
    const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return new Password(hashed);
  }

  static fromHash(hashedValue: string): Password {
    return new Password(hashedValue);
  }

  async compare(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.hashedValue);
  }

  getValue(): string {
    return this.hashedValue;
  }

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
