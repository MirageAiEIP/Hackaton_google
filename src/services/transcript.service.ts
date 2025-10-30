import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';

export class TranscriptService {
  async getCallTranscript(callId: string) {
    logger.info('Getting transcript for call', { callId });

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

  async getFormattedTranscript(callId: string) {
    logger.info('Getting formatted transcript for call', { callId });

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

  async getCallTranscripts(callIds: string[]) {
    logger.info('Getting transcripts for multiple calls', { count: callIds.length });

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

  async searchTranscripts(keyword: string, options: { limit?: number; offset?: number } = {}) {
    logger.info('Searching transcripts for keyword', { keyword });

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

  async getTranscriptStats(callId: string) {
    logger.info('Getting transcript stats for call', { callId });

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        elevenLabsConversation: true,
      },
    });

    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    // Use call.transcript which contains the COMPLETE conversation (AI + Operator)
    const transcript = call.transcript || '';
    const words = transcript.split(/\s+/).filter((w) => w.length > 0);
    const lines = transcript.split('\n').filter((l) => l.trim() !== '');

    // Count messages by speaker type
    const agentLines = lines.filter((l) => l.startsWith('Agent:')).length;
    const operatorLines = lines.filter((l) => l.startsWith('Operator:')).length;
    const userLines = lines.filter((l) => l.startsWith('User:')).length;
    const systemLines = lines.filter(
      (l) => !l.startsWith('Agent:') && !l.startsWith('Operator:') && !l.startsWith('User:')
    ).length;

    // Count words per speaker
    const agentWords = lines
      .filter((l) => l.startsWith('Agent:'))
      .join(' ')
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    const operatorWords = lines
      .filter((l) => l.startsWith('Operator:'))
      .join(' ')
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    const userWords = lines
      .filter((l) => l.startsWith('User:'))
      .join(' ')
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      callId: call.id,
      hasTranscript: !!call.transcript,
      hasStructuredTranscript: !!call.elevenLabsConversation?.transcript,

      // Overall stats on COMPLETE conversation
      wordCount: words.length,
      lineCount: lines.length,
      characterCount: transcript.length,
      estimatedReadingTimeMinutes: Math.ceil(words.length / 200), // Avg reading speed 200 wpm

      // Breakdown by speaker (shows AI + Operator contribution)
      speakerBreakdown: {
        agent: {
          lines: agentLines,
          words: agentWords,
        },
        operator: {
          lines: operatorLines,
          words: operatorWords,
        },
        user: {
          lines: userLines,
          words: userWords,
        },
        system: {
          lines: systemLines,
        },
        total: {
          lines: agentLines + operatorLines + userLines + systemLines,
          words: agentWords + operatorWords + userWords,
        },
      },

      // Use call.duration (total duration including operator phase)
      // NOT elevenLabsConversation.durationSeconds (only AI phase)
      duration: call.duration,

      // Optional: AI phase stats for comparison
      aiPhaseOnly: call.elevenLabsConversation
        ? {
            durationSeconds: call.elevenLabsConversation.durationSeconds,
            messageCount: Array.isArray(call.elevenLabsConversation.transcript)
              ? call.elevenLabsConversation.transcript.length
              : 0,
          }
        : null,
    };
  }
}

export const transcriptService = new TranscriptService();
