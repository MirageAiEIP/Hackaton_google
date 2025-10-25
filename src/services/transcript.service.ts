import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';

/**
 * Service for managing and retrieving call transcripts
 */
export class TranscriptService {
  /**
   * Get the transcript for a specific call
   * Includes both Call.transcript and ElevenLabsConversation.transcript if available
   */
  async getCallTranscript(callId: string) {
    logger.info('📝 Getting transcript for call', { callId });

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
        patient: {
          select: {
            id: true,
            age: true,
            gender: true,
            phoneHash: true,
          },
        },
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    // Extract ElevenLabs transcript if available
    let elevenLabsTranscript = null;
    if (call.elevenLabsConversation) {
      elevenLabsTranscript = {
        conversationId: call.elevenLabsConversation.conversationId,
        transcript: call.elevenLabsConversation.transcript,
        durationSeconds: call.elevenLabsConversation.durationSeconds,
        startTime: call.elevenLabsConversation.startTime,
        endTime: call.elevenLabsConversation.endTime,
        status: call.elevenLabsConversation.status,
      };
    }

    return {
      callId: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      // Basic transcript (string)
      basicTranscript: call.transcript,
      // Structured ElevenLabs transcript (JSON with timestamps, speaker labels, etc.)
      structuredTranscript: elevenLabsTranscript,
      patient: call.patient,
    };
  }

  /**
   * Get formatted transcript with conversation structure
   * Parses the ElevenLabs JSON transcript into a readable format
   */
  async getFormattedTranscript(callId: string) {
    logger.info('📄 Getting formatted transcript for call', { callId });

    const transcriptData = await this.getCallTranscript(callId);

    // If we have structured transcript from ElevenLabs, format it
    if (transcriptData.structuredTranscript?.transcript) {
      const formattedMessages = this.formatElevenLabsTranscript(
        transcriptData.structuredTranscript.transcript
      );

      return {
        callId: transcriptData.callId,
        status: transcriptData.status,
        startedAt: transcriptData.startedAt,
        endedAt: transcriptData.endedAt,
        duration: transcriptData.duration,
        messages: formattedMessages,
        patient: transcriptData.patient,
      };
    }

    // Fallback to basic transcript
    return {
      callId: transcriptData.callId,
      status: transcriptData.status,
      startedAt: transcriptData.startedAt,
      endedAt: transcriptData.endedAt,
      duration: transcriptData.duration,
      messages: this.parseBasicTranscript(transcriptData.basicTranscript || ''),
      patient: transcriptData.patient,
    };
  }

  /**
   * Format ElevenLabs JSON transcript
   * The structure depends on ElevenLabs API response format
   */
  private formatElevenLabsTranscript(transcript: unknown): Array<{
    index: number;
    timestamp: string | null;
    speaker: string;
    text: string;
    confidence: number | null;
  }> {
    // Handle different possible formats
    if (Array.isArray(transcript)) {
      return transcript.map((msg: Record<string, unknown>, index: number) => ({
        index: index + 1,
        timestamp: (msg.timestamp as string) || (msg.time as string) || null,
        speaker: (msg.speaker as string) || (msg.role as string) || 'unknown',
        text: (msg.text as string) || (msg.content as string) || (msg.message as string) || '',
        confidence: (msg.confidence as number) || null,
      }));
    }

    // If transcript is an object with a messages array
    const transcriptObj = transcript as Record<string, unknown>;
    if (transcriptObj.messages && Array.isArray(transcriptObj.messages)) {
      return transcriptObj.messages.map((msg: Record<string, unknown>, index: number) => ({
        index: index + 1,
        timestamp: (msg.timestamp as string) || (msg.time as string) || null,
        speaker: (msg.speaker as string) || (msg.role as string) || 'unknown',
        text: (msg.text as string) || (msg.content as string) || (msg.message as string) || '',
        confidence: (msg.confidence as number) || null,
      }));
    }

    // If it's just raw text
    if (typeof transcript === 'string') {
      return this.parseBasicTranscript(transcript);
    }

    return [];
  }

  /**
   * Parse basic text transcript into messages
   * Tries to detect speaker patterns like "Agent: " or "Patient: "
   */
  private parseBasicTranscript(transcript: string): Array<{
    index: number;
    timestamp: string | null;
    speaker: string;
    text: string;
    confidence: number | null;
  }> {
    if (!transcript || transcript.trim() === '') {
      return [];
    }

    const lines = transcript.split('\n').filter((line) => line.trim() !== '');
    const messages: Array<{
      index: number;
      timestamp: string | null;
      speaker: string;
      text: string;
      confidence: number | null;
    }> = [];

    lines.forEach((line, index) => {
      // Try to detect speaker patterns
      const speakerMatch = line.match(/^(Agent|Patient|Operator|System):\s*(.+)$/i);

      if (speakerMatch && speakerMatch[1] && speakerMatch[2]) {
        messages.push({
          index: index + 1,
          timestamp: null,
          speaker: speakerMatch[1].toLowerCase(),
          text: speakerMatch[2].trim(),
          confidence: null,
        });
      } else {
        // No speaker detected, treat as continuation or system message
        messages.push({
          index: index + 1,
          timestamp: null,
          speaker: 'system',
          text: line.trim(),
          confidence: null,
        });
      }
    });

    return messages;
  }

  /**
   * Get transcript for multiple calls (bulk retrieval)
   */
  async getCallTranscripts(callIds: string[]) {
    logger.info('📚 Getting transcripts for multiple calls', { count: callIds.length });

    const calls = await prisma.call.findMany({
      where: {
        id: {
          in: callIds,
        },
      },
      include: {
        elevenLabsConversation: true,
        patient: {
          select: {
            id: true,
            age: true,
            gender: true,
            phoneHash: true,
          },
        },
      },
    });

    return calls.map((call) => ({
      callId: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      hasTranscript: !!call.transcript,
      hasStructuredTranscript: !!call.elevenLabsConversation?.transcript,
      transcriptPreview: call.transcript?.substring(0, 200) || null,
    }));
  }

  /**
   * Search transcripts by keyword
   */
  async searchTranscripts(keyword: string, options: { limit?: number; offset?: number } = {}) {
    logger.info('🔍 Searching transcripts for keyword', { keyword });

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Search in Call.transcript field
    const calls = await prisma.call.findMany({
      where: {
        transcript: {
          contains: keyword,
          mode: 'insensitive',
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            age: true,
            gender: true,
          },
        },
        triageReport: {
          select: {
            priorityLevel: true,
            chiefComplaint: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return calls.map((call) => ({
      callId: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      patient: call.patient,
      priority: call.triageReport?.priorityLevel,
      chiefComplaint: call.triageReport?.chiefComplaint,
      transcriptExcerpt: this.extractExcerpt(call.transcript || '', keyword, 150),
    }));
  }

  /**
   * Extract excerpt from transcript around keyword
   */
  private extractExcerpt(text: string, keyword: string, maxLength: number): string {
    if (!text) {
      return '';
    }

    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKeyword);

    if (index === -1) {
      return text.substring(0, maxLength);
    }

    const start = Math.max(0, index - maxLength / 2);
    const end = Math.min(text.length, index + keyword.length + maxLength / 2);

    let excerpt = text.substring(start, end);

    if (start > 0) {
      excerpt = '...' + excerpt;
    }
    if (end < text.length) {
      excerpt = excerpt + '...';
    }

    return excerpt;
  }

  /**
   * Get transcript statistics for a call
   */
  async getTranscriptStats(callId: string) {
    logger.info('📊 Getting transcript stats for call', { callId });

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    const transcript = call.transcript || '';
    const words = transcript.split(/\s+/).filter((w) => w.length > 0);
    const lines = transcript.split('\n').filter((l) => l.trim() !== '');

    return {
      callId: call.id,
      hasTranscript: !!call.transcript,
      hasStructuredTranscript: !!call.elevenLabsConversation?.transcript,
      wordCount: words.length,
      lineCount: lines.length,
      characterCount: transcript.length,
      estimatedReadingTimeMinutes: Math.ceil(words.length / 200), // Avg reading speed 200 wpm
      duration: call.elevenLabsConversation?.durationSeconds || call.duration,
    };
  }
}

export const transcriptService = new TranscriptService();
