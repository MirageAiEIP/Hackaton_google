import { DomainEvent } from '@/domain/shared/DomainEvent';

/**
 * Domain Event: Call Info Updated
 * Published when call information is automatically extracted and updated from transcript
 */
export class CallInfoUpdatedEvent extends DomainEvent {
  constructor(
    public readonly callId: string,
    public readonly updatedFields: string[],
    public readonly extractedData: {
      age?: number;
      gender?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      priority?: 'P0' | 'P1' | 'P2' | 'P3';
      priorityReason?: string;
      chiefComplaint?: string;
      currentSymptoms?: string;
      consciousness?: 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';
    },
    correlationId?: string
  ) {
    super(correlationId);
  }
}
