import { Call } from '../entities/Call.entity';

export interface ICallRepository {
  save(call: Call): Promise<void>;

  findById(id: string): Promise<Call | null>;

  findByPhoneHash(phoneHash: string): Promise<Call[]>;

  findActiveCalls(): Promise<Call[]>;

  delete(id: string): Promise<void>;
}
