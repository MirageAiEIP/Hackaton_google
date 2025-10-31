import type { FastifyRequest } from 'fastify';
import type { WebSocket as FastifyWebSocket } from '@fastify/websocket';
import WebSocket from 'ws';
import { logger } from '@/utils/logger';
import { loadSecrets } from '@/config/secrets.config';
import { callService } from './call.service';
import { handoffService } from './handoff.service';
import { Container } from '@/infrastructure/di/Container';
import { WebSessionStartedEvent } from '@/domain/call/events/WebSessionStarted.event';
import { WebSessionEndedEvent } from '@/domain/call/events/WebSessionEnded.event';
import { elevenLabsSTTService } from './elevenlabs-stt.service';
import { conversationPersistenceService } from './conversation-persistence.service';
import { callInfoExtractionService } from './call-info-extraction.service';

export class TwilioElevenLabsProxyService {
  private apiKey: string = '';
  private agentId: string = '';
  private initialized = false;

  // Store active web conversations to allow operator takeover
  private activeWebSessions = new Map<
    string,
    {
      clientWs: FastifyWebSocket;
      elevenLabsWs: WebSocket | null;
      callId: string;
      sessionId: string;
      keepClientConnected: boolean; // Don't close client when AI disconnects (operator takeover)
    }
  >();

  // Global mapping: conversationId → callId (pour les tools ElevenLabs)
  private static conversationToCallMap = new Map<string, string>();

  // Store active ElevenLabs WebSocket connections by callId (for sending contextual updates)
  private activeElevenLabsConnections = new Map<string, WebSocket>();

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const secrets = await loadSecrets();
    this.apiKey = secrets.elevenlabsApiKey;
    this.agentId = secrets.elevenlabsAgentId;

    if (!this.agentId) {
      throw new Error('ELEVENLABS_AGENT_ID not configured');
    }

    this.initialized = true;
    logger.info('Twilio-ElevenLabs Proxy Service initialized');
  }

  static getCallIdFromConversation(conversationId: string): string | undefined {
    return this.conversationToCallMap.get(conversationId);
  }

  private storeConversationMapping(conversationId: string, callId: string): void {
    TwilioElevenLabsProxyService.conversationToCallMap.set(conversationId, callId);
    logger.info('Stored conversation mapping', { conversationId, callId });
  }

  /**
   * Extract conversation ID from ElevenLabs message
   * Handles both top-level and nested conversation_id formats
   */
  private extractConversationId(message: {
    conversation_id?: string;
    conversation_initiation_metadata_event?: { conversation_id?: string };
  }): string | undefined {
    return (
      message.conversation_id || message.conversation_initiation_metadata_event?.conversation_id
    );
  }

  /**
   * Send a contextual update to an active ElevenLabs conversation
   * Used to notify the AI agent about external events (e.g., operator availability)
   * @param callId - The call ID
   * @param message - The message to send to the agent
   * @returns true if message was sent successfully, false if no active connection found
   */
  sendContextualUpdate(callId: string, message: string): boolean {
    const elevenLabsWs = this.activeElevenLabsConnections.get(callId);

    if (!elevenLabsWs || elevenLabsWs.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send contextual update: No active ElevenLabs connection', { callId });
      return false;
    }

    try {
      elevenLabsWs.send(
        JSON.stringify({
          type: 'contextual_update',
          text: message,
        })
      );

      logger.info('Sent contextual update to ElevenLabs agent', { callId, message });
      return true;
    } catch (error) {
      logger.error('Failed to send contextual update', error as Error, { callId, message });
      return false;
    }
  }

  async handleTwilioConnection(twilioWs: FastifyWebSocket, request: FastifyRequest): Promise<void> {
    await this.initialize();

    const callSid = (request.query as { callSid?: string }).callSid;
    logger.info('Twilio Media Stream connected', { callSid });

    let elevenLabsWs: WebSocket | null = null;
    let callId: string | null = null;
    let streamSid: string | null = null;
    let conversationId: string | null = null;
    let extractionInterval: NodeJS.Timeout | null = null;
    let lastTranscriptLength = 0; // Éviter extractions inutiles si transcript identique
    let audioBuffer: Array<string> = []; // Buffer for audio before ElevenLabs ready
    let elevenLabsReady = false;
    let audioPacketsSent = 0; // Count audio packets sent to ElevenLabs

    // Connect to ElevenLabs WebSocket
    try {
      const elevenLabsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;

      logger.info('Attempting ElevenLabs WebSocket connection', {
        callSid,
        agentId: this.agentId,
        apiKeyPrefix: this.apiKey?.substring(0, 10) + '...',
        url: elevenLabsUrl,
      });

      elevenLabsWs = new WebSocket(elevenLabsUrl, {
        headers: {
          'xi-api-key': this.apiKey,
        },
        handshakeTimeout: 10000, // 10 seconds timeout
      });

      logger.info('ElevenLabs WebSocket object created, waiting for open event', { callSid });

      // Envoyer le callId à l'agent via conversation_initiation_client_data dès la connexion
      elevenLabsWs.on('open', () => {
        clearTimeout(connectionTimeout);
        logger.info('ElevenLabs WebSocket connected successfully', {
          callSid,
          callId,
          bufferedAudioPackets: audioBuffer.length,
        });
        elevenLabsReady = true;

        // Flush buffered audio packets
        if (audioBuffer.length > 0) {
          logger.info('Flushing buffered audio packets to ElevenLabs', {
            count: audioBuffer.length,
            callSid,
          });
          audioBuffer.forEach((payload) => {
            elevenLabsWs!.send(
              JSON.stringify({
                type: 'audio',
                audio_event: {
                  audio_base_64: payload,
                  encoding: 'mulaw_8000',
                },
              })
            );
            audioPacketsSent++;
          });
          logger.info(
            `Flushed ${audioBuffer.length} audio packets, total sent: ${audioPacketsSent}`,
            {
              callSid,
            }
          );
          audioBuffer = [];
        }

        // Store the connection for potential contextual updates
        if (callId) {
          this.activeElevenLabsConnections.set(callId, elevenLabsWs!);
          logger.info('Stored ElevenLabs connection for Twilio call', { callId });
        }

        // Envoyer le callId dans custom_llm_extra_body pour que l'agent puisse l'utiliser
        elevenLabsWs!.send(
          JSON.stringify({
            type: 'conversation_initiation_client_data',
            conversation_initiation_client_data: {
              custom_llm_extra_body: {
                callId: callId,
              },
            },
          })
        );

        logger.info('Sent callId via conversation_initiation_client_data to ElevenLabs agent', {
          callSid,
          callId,
        });

        // ===== EXTRACTION AUTOMATIQUE TOUTES LES 10 SECONDES =====
        logger.info('[EXTRACTION] Starting real-time extraction every 10 seconds', { callId });

        extractionInterval = setInterval(async () => {
          if (!callId) {
            logger.debug('[EXTRACTION] Skipping - no callId yet');
            return;
          }

          try {
            logger.debug('[EXTRACTION] Fetching call data...', { callId });
            const call = await callService.getCallById(callId);

            if (!call) {
              logger.warn('[EXTRACTION] Call not found in database', { callId });
              return;
            }

            if (!call.transcript || call.transcript.trim().length === 0) {
              logger.debug('[EXTRACTION] Skipping - transcript is empty', {
                callId,
                transcriptLength: 0,
              });
              return;
            }

            // Optimisation: Skip si transcript n'a pas changé
            const currentLength = call.transcript.length;
            if (currentLength === lastTranscriptLength) {
              logger.debug('[EXTRACTION] Skipping - transcript unchanged', {
                callId,
                transcriptLength: currentLength,
              });
              return;
            }

            lastTranscriptLength = currentLength;

            logger.info('[EXTRACTION] Transcript changed - running extraction', {
              callId,
              transcriptLength: currentLength,
              transcriptPreview: call.transcript.substring(0, 100) + '...',
            });

            const result = await callInfoExtractionService.extractAndUpdateCall({
              callId,
              transcript: call.transcript,
              call, // Passer l'objet call pour éviter double fetch
            });

            if (result.success && result.updated.length > 0) {
              logger.info('[EXTRACTION] Successfully updated fields', {
                callId,
                updatedCount: result.updated.length,
                updated: result.updated,
              });
            } else if (result.success && result.updated.length === 0) {
              logger.debug('[EXTRACTION] No new fields to update', { callId });
            } else {
              logger.warn('[EXTRACTION] Extraction failed', { callId });
            }
          } catch (error) {
            logger.error('[EXTRACTION] Error during extraction', error as Error, { callId });
          }
        }, 10000); // Toutes les 10 secondes (optimisé)

        logger.info('[EXTRACTION] Interval started successfully', {
          callId,
          intervalSeconds: 10,
          intervalId: extractionInterval ? 'SET' : 'NULL',
        });
      });

      // ElevenLabs → Twilio: Forward audio responses
      elevenLabsWs.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          logger.info(`ElevenLabs message: ${message.type}`, {
            callSid,
            hasAudio: !!message.audio_event,
            hasTranscript: !!message.transcript_event,
            conversationId: message.conversation_id,
          });

          // Capturer le conversation_id from initiation metadata or top level
          const conversationIdFromMessage = this.extractConversationId(message);

          if (conversationIdFromMessage && callId) {
            this.storeConversationMapping(conversationIdFromMessage, callId);
          }

          // Forward audio to Twilio
          if (message.type === 'audio' && message.audio_event) {
            logger.info('Forwarding ElevenLabs audio to Twilio', {
              callSid,
              audioLength: message.audio_event.audio_base_64?.length || 0,
            });
            const audioBase64 = message.audio_event.audio_base_64;

            twilioWs.send(
              JSON.stringify({
                event: 'media',
                streamSid,
                media: {
                  payload: audioBase64,
                },
              })
            );
          }

          // Capture conversation ID from ElevenLabs (from top level or initiation metadata)
          if (conversationIdFromMessage && !conversationId) {
            conversationId = conversationIdFromMessage;
            logger.info('Captured ElevenLabs conversation ID', {
              conversationId,
              callId,
              callSid,
            });
          }

          // Log transcript
          if (message.type === 'transcript' && message.transcript_event) {
            logger.info(
              `ElevenLabs transcript [${message.transcript_event.role}]: ${message.transcript_event.text}`,
              {
                role: message.transcript_event.role,
                callSid,
                conversationId,
              }
            );
          }

          // Log other message types
          if (message.type && !['audio', 'transcript'].includes(message.type)) {
            logger.info(`ElevenLabs special message: ${message.type}`, {
              callSid,
              messageKeys: Object.keys(message),
            });
          }
        } catch (error) {
          logger.error('Failed to process ElevenLabs message', error as Error, { callSid });
        }
      });

      // Timeout si connexion ne s'établit pas
      const connectionTimeout = setTimeout(() => {
        if (!elevenLabsReady) {
          const timeoutError = new Error(
            'ElevenLabs WebSocket connection timeout after 10 seconds'
          );
          logger.error('ElevenLabs WebSocket connection timeout after 10 seconds', timeoutError, {
            callSid,
            agentId: this.agentId,
            wsReadyState: elevenLabsWs?.readyState,
            readyStateText:
              elevenLabsWs?.readyState === 0
                ? 'CONNECTING'
                : elevenLabsWs?.readyState === 1
                  ? 'OPEN'
                  : elevenLabsWs?.readyState === 2
                    ? 'CLOSING'
                    : 'CLOSED',
          });
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
        }
      }, 10000);

      elevenLabsWs.on('error', (error: Error) => {
        clearTimeout(connectionTimeout);
        logger.error('ElevenLabs WebSocket error', error, {
          callSid,
          errorMessage: error.message,
          errorStack: error.stack,
          agentId: this.agentId,
          apiKeyPrefix: this.apiKey?.substring(0, 10) + '...',
        });

        // Cleanup extraction interval on error
        if (extractionInterval) {
          clearInterval(extractionInterval);
          extractionInterval = null;
          logger.info('[EXTRACTION] Cleared extraction interval due to ElevenLabs error', {
            callSid,
            callId,
          });
        }
      });

      elevenLabsWs.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectionTimeout);
        logger.info('ElevenLabs WebSocket closed', {
          callSid,
          closeCode: code,
          closeReason: reason.toString(),
          wasConnected: elevenLabsReady,
        });

        // Cleanup extraction interval
        if (extractionInterval) {
          clearInterval(extractionInterval);
          extractionInterval = null;
          logger.info('[EXTRACTION] Cleared extraction interval on ElevenLabs close', {
            callSid,
            callId,
          });
        }

        // Remove the connection from active connections
        if (callId) {
          this.activeElevenLabsConnections.delete(callId);
          logger.info('Removed ElevenLabs connection for Twilio call', { callId });
        }

        twilioWs.close();
      });
    } catch (error) {
      logger.error('Failed to create ElevenLabs WebSocket', error as Error, {
        callSid,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
        agentId: this.agentId,
        apiKeyPrefix: this.apiKey?.substring(0, 10) + '...',
      });
      twilioWs.close();
      return;
    }

    // Twilio → ElevenLabs: Forward audio
    twilioWs.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle Twilio stream start
        if (message.event === 'start') {
          streamSid = message.start.streamSid;
          const customParameters = message.start.customParameters;

          logger.info('Twilio Media Stream started', {
            streamSid,
            callSid: customParameters?.callSid,
            customParameters,
          });

          // Create call in database
          if (customParameters?.From) {
            const call = await callService.createCall({
              phoneNumber: customParameters.From,
            });
            callId = call.id;
            logger.info('Call created from Twilio stream', { callId, streamSid });

            // Envoyer le callId à ElevenLabs via conversation_initiation_client_data
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              elevenLabsWs.send(
                JSON.stringify({
                  type: 'conversation_initiation_client_data',
                  custom_llm_extra_body: {
                    callId: callId, // Accessible dans tous les tools
                  },
                })
              );
              logger.info('Sent conversation_initiation_client_data to ElevenLabs', {
                callId,
                callSid,
              });
            }
          }
        }

        // Handle media (audio) from Twilio
        if (message.event === 'media') {
          const audioPayload = message.media.payload;

          // Check if ElevenLabs is ready and connected
          if (elevenLabsWs && elevenLabsReady && elevenLabsWs.readyState === WebSocket.OPEN) {
            // Forward to ElevenLabs immediately
            // Note: Twilio sends mulaw 8kHz
            elevenLabsWs.send(
              JSON.stringify({
                type: 'audio',
                audio_event: {
                  audio_base_64: audioPayload,
                  encoding: 'mulaw_8000',
                },
              })
            );
            audioPacketsSent++;
            if (audioPacketsSent === 1 || audioPacketsSent % 100 === 0) {
              logger.info('Sending Twilio audio to ElevenLabs', {
                callSid,
                packetsSent: audioPacketsSent,
                payloadLength: audioPayload.length,
              });
            }
          } else {
            // Buffer audio until ElevenLabs connects
            audioBuffer.push(audioPayload);
            if (audioBuffer.length === 1) {
              logger.warn('Started buffering audio - ElevenLabs not ready yet', {
                callSid,
                streamSid,
                elevenLabsExists: !!elevenLabsWs,
                elevenLabsReady,
                wsReadyState: elevenLabsWs?.readyState,
              });
            }
            if (audioBuffer.length % 50 === 0) {
              logger.warn('Audio buffer growing', {
                callSid,
                bufferSize: audioBuffer.length,
                elevenLabsReady,
              });
            }
          }
        }

        // Handle stream stop
        if (message.event === 'stop') {
          logger.info('Twilio Media Stream stopped', { streamSid, callSid });

          // Cleanup extraction interval
          if (extractionInterval) {
            clearInterval(extractionInterval);
            extractionInterval = null;
            logger.info('[EXTRACTION] Cleared extraction interval on stream stop', {
              streamSid,
              callSid,
              callId,
            });
          }

          if (elevenLabsWs) {
            elevenLabsWs.close();
          }

          // Update call status and save transcript
          if (callId) {
            await callService.updateCallStatus(callId, 'COMPLETED');

            // Save ElevenLabs conversation transcript
            if (conversationId) {
              logger.info('Saving conversation transcript', { callId, conversationId });

              // Save asynchronously - don't block call completion
              conversationPersistenceService
                .saveConversation({
                  conversationId,
                  callId,
                  agentId: this.agentId,
                })
                .catch((err) => {
                  logger.error('Failed to save conversation (async)', err as Error, {
                    callId,
                    conversationId,
                  });
                });
            } else {
              logger.warn('No conversation ID available for transcript saving', { callId });
            }
          }
        }
      } catch (error) {
        logger.error('Failed to process Twilio message', error as Error, { callSid });
      }
    });

    twilioWs.on('error', (error: Error) => {
      logger.error('Twilio WebSocket error', error, { callSid });

      // Cleanup extraction interval on error
      if (extractionInterval) {
        clearInterval(extractionInterval);
        extractionInterval = null;
        logger.info('[EXTRACTION] Cleared extraction interval due to Twilio error', {
          callSid,
          callId,
        });
      }
    });

    twilioWs.on('close', () => {
      logger.info('Twilio WebSocket closed', { callSid });

      // Cleanup extraction interval
      if (extractionInterval) {
        clearInterval(extractionInterval);
        extractionInterval = null;
        logger.info('[EXTRACTION] Cleared extraction interval on Twilio close', {
          callSid,
          callId,
        });
      }

      if (elevenLabsWs) {
        elevenLabsWs.close();
      }
    });
  }

  async handleWebConnection(clientWs: FastifyWebSocket, request: FastifyRequest): Promise<void> {
    await this.initialize();

    const query = request.query as { sessionId?: string; callId?: string };
    const sessionId = query.sessionId;
    const callId = query.callId || null;

    logger.info('Web conversation connected', { sessionId, callId });

    let elevenLabsWs: WebSocket | null = null;
    let conversationId: string | null = null;
    let extractionInterval: NodeJS.Timeout | null = null;
    let lastTranscriptLength = 0; // Éviter extractions inutiles si transcript identique

    // Connect to ElevenLabs WebSocket
    try {
      const elevenLabsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;

      elevenLabsWs = new WebSocket(elevenLabsUrl, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      logger.info('Connecting to ElevenLabs WebSocket for web conversation', { sessionId });

      elevenLabsWs.on('open', () => {
        logger.info('ElevenLabs WebSocket connected for web conversation', { sessionId });

        // Store the connection for potential contextual updates
        if (callId) {
          this.activeElevenLabsConnections.set(callId, elevenLabsWs!);
          logger.info('Stored ElevenLabs connection for web call', { callId });
        }

        // Envoyer le message d'initialisation à ElevenLabs
        elevenLabsWs!.send(
          JSON.stringify({
            type: 'conversation_initiation_client_data',
            custom_llm_extra_body: {
              callId: callId, // Accessible dans tous les tools
            },
          })
        );

        // Envoyer le callId comme contexte à l'agent
        if (callId) {
          elevenLabsWs!.send(
            JSON.stringify({
              type: 'contextual_update',
              text: `callId: ${callId}`,
            })
          );

          logger.info('Sent callId via contextual_update to ElevenLabs agent', {
            sessionId,
            callId,
          });
        }

        logger.info('Sent conversation_initiation_client_data to ElevenLabs', {
          sessionId,
          callId,
        });

        // Store active session for potential operator takeover
        if (sessionId && callId) {
          this.activeWebSessions.set(sessionId, {
            clientWs,
            elevenLabsWs,
            callId,
            sessionId,
            keepClientConnected: false, // Default: close client when AI disconnects
          });
          logger.info('Stored active web session', { sessionId, callId });

          // Broadcast session started event to dashboard
          this.broadcastSessionStarted(callId, sessionId).catch((err) => {
            logger.error('Failed to broadcast session started event', err as Error);
          });
        }

        // ===== EXTRACTION AUTOMATIQUE TOUTES LES 10 SECONDES (WEB) =====
        if (callId) {
          logger.info('[EXTRACTION] Starting real-time extraction every 10 seconds (Web)', {
            callId,
            sessionId,
          });

          extractionInterval = setInterval(async () => {
            if (!callId) {
              logger.debug('[EXTRACTION] Skipping - no callId yet');
              return;
            }

            try {
              logger.debug('[EXTRACTION] Fetching call data...', { callId, sessionId });
              const call = await callService.getCallById(callId);

              if (!call) {
                logger.warn('[EXTRACTION] Call not found in database', { callId, sessionId });
                return;
              }

              if (!call.transcript || call.transcript.trim().length === 0) {
                logger.debug('[EXTRACTION] Skipping - transcript is empty', {
                  callId,
                  sessionId,
                  transcriptLength: 0,
                });
                return;
              }

              // Optimisation: Skip si transcript n'a pas changé
              const currentLength = call.transcript.length;
              if (currentLength === lastTranscriptLength) {
                logger.debug('[EXTRACTION] Skipping - transcript unchanged', {
                  callId,
                  sessionId,
                  transcriptLength: currentLength,
                });
                return;
              }

              lastTranscriptLength = currentLength;

              logger.info('[EXTRACTION] Transcript changed - running extraction', {
                callId,
                sessionId,
                transcriptLength: currentLength,
                transcriptPreview: call.transcript.substring(0, 100) + '...',
              });

              const result = await callInfoExtractionService.extractAndUpdateCall({
                callId,
                transcript: call.transcript,
                call, // Passer l'objet call pour éviter double fetch
              });

              if (result.success && result.updated.length > 0) {
                logger.info('[EXTRACTION] Successfully updated fields', {
                  callId,
                  sessionId,
                  updatedCount: result.updated.length,
                  updated: result.updated,
                });
              } else if (result.success && result.updated.length === 0) {
                logger.debug('[EXTRACTION] No new fields to update', { callId, sessionId });
              } else {
                logger.warn('[EXTRACTION] Extraction failed', { callId, sessionId });
              }
            } catch (error) {
              logger.error('[EXTRACTION] Error during extraction', error as Error, {
                callId,
                sessionId,
              });
            }
          }, 10000); // Toutes les 10 secondes (optimisé)

          logger.info('[EXTRACTION] Interval started successfully (Web)', {
            callId,
            sessionId,
            intervalSeconds: 10,
            intervalId: extractionInterval ? 'SET' : 'NULL',
          });
        }

        // Notify client that connection is ready
        clientWs.send(JSON.stringify({ type: 'connected', status: 'ready' }));
      });

      // ElevenLabs → Browser: Forward all messages
      elevenLabsWs.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          logger.debug('ElevenLabs message received', {
            type: message.type,
            sessionId,
          });

          // Capture conversation ID from ElevenLabs (from top level or initiation metadata)
          const conversationIdFromMessage = this.extractConversationId(message);

          if (conversationIdFromMessage && !conversationId) {
            conversationId = conversationIdFromMessage;
            logger.info('Captured ElevenLabs conversation ID (web)', {
              conversationId,
              callId,
              sessionId,
            });
          }

          // Capturer le conversation_id d'ElevenLabs et le mapper au callId
          if (conversationIdFromMessage && callId) {
            this.storeConversationMapping(conversationIdFromMessage, callId);
          }

          // Gérer les ping events (keep-alive)
          if (message.type === 'ping' && message.ping_event) {
            logger.debug('Ping event received', {
              sessionId,
              eventId: message.ping_event.event_id,
            });

            // Répondre avec un pong après le délai spécifié
            const pingMs = message.ping_event.ping_ms || 0;
            setTimeout(() => {
              if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
                elevenLabsWs.send(
                  JSON.stringify({
                    type: 'pong',
                    event_id: message.ping_event.event_id,
                  })
                );
                logger.debug('Pong sent to ElevenLabs', {
                  sessionId,
                  eventId: message.ping_event.event_id,
                });
              }
            }, pingMs);
          }

          // Forward message to browser
          clientWs.send(data.toString());

          // Log and save transcript to database
          if (message.type === 'user_transcript' && message.user_transcription_event) {
            const userText = message.user_transcription_event.user_transcript;
            logger.info('User transcript', {
              text: userText,
              sessionId,
            });

            if (callId) {
              await callService.appendTranscript(callId, `User: ${userText}`);
            }
          }

          if (message.type === 'agent_response' && message.agent_response_event) {
            const agentText = message.agent_response_event.agent_response;
            logger.info('Agent response', {
              text: agentText,
              sessionId,
            });

            if (callId) {
              await callService.appendTranscript(callId, `Agent: ${agentText}`);
            }
          }
        } catch (error) {
          logger.error('Failed to process ElevenLabs message', error as Error, { sessionId });
        }
      });

      elevenLabsWs.on('error', (error: Error) => {
        logger.error('ElevenLabs WebSocket error', error, { sessionId });

        // Cleanup extraction interval on error
        if (extractionInterval) {
          clearInterval(extractionInterval);
          extractionInterval = null;
          logger.info('[EXTRACTION] Cleared extraction interval due to ElevenLabs error (Web)', {
            sessionId,
            callId,
          });
        }
      });

      elevenLabsWs.on('close', async () => {
        logger.info('ElevenLabs WebSocket closed', { sessionId });

        // Cleanup extraction interval
        if (extractionInterval) {
          clearInterval(extractionInterval);
          extractionInterval = null;
          logger.info('[EXTRACTION] Cleared extraction interval on ElevenLabs close (Web)', {
            sessionId,
            callId,
          });
        }

        // Remove the connection from active connections
        if (callId) {
          this.activeElevenLabsConnections.delete(callId);
          logger.info('Removed ElevenLabs connection for web call', { callId });
        }

        // Save conversation transcript if we have the IDs
        if (callId && conversationId) {
          logger.info('Saving web conversation transcript', { callId, conversationId, sessionId });

          // Save asynchronously - don't block WebSocket cleanup
          conversationPersistenceService
            .saveConversation({
              conversationId,
              callId,
              agentId: this.agentId,
            })
            .catch((err) => {
              logger.error('Failed to save web conversation (async)', err as Error, {
                callId,
                conversationId,
                sessionId,
              });
            });

          // Update call status to completed
          await callService.updateCallStatus(callId, 'COMPLETED').catch((err) => {
            logger.error('Failed to update call status', err as Error, { callId });
          });
        }

        // Check if we should keep client connected (operator takeover scenario)
        if (!sessionId) {
          // No sessionId, close client
          clientWs.close();
          return;
        }

        const session = this.activeWebSessions.get(sessionId);
        if (session && !session.keepClientConnected) {
          clientWs.close();
          logger.info('Client WebSocket closed (normal flow)', { sessionId });
        } else if (session && session.keepClientConnected) {
          logger.info('Client WebSocket kept open for operator takeover', { sessionId });
        } else {
          // Session not found, close client anyway
          clientWs.close();
        }
      });
    } catch (error) {
      logger.error('Failed to connect to ElevenLabs', error as Error, { sessionId });

      // Cleanup extraction interval on connection error
      if (extractionInterval) {
        clearInterval(extractionInterval);
        extractionInterval = null;
        logger.info('[EXTRACTION] Cleared extraction interval due to connection error (Web)', {
          sessionId,
          callId,
        });
      }

      clientWs.close();
      return;
    }

    // Browser → ElevenLabs: Transform and forward audio
    clientWs.on('message', async (data: Buffer) => {
      try {
        if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
          const message = JSON.parse(data.toString());

          // Le navigateur envoie: { type: 'audio', audio_base_64: '...' }
          // On transforme pour ElevenLabs: { user_audio_chunk: '...' }
          if (message.type === 'audio' && message.audio_base_64) {
            elevenLabsWs.send(
              JSON.stringify({
                user_audio_chunk: message.audio_base_64,
              })
            );

            logger.debug('Forwarded audio chunk to ElevenLabs', { sessionId });
          }
          // Gérer le ping/pong
          else if (message.type === 'pong') {
            elevenLabsWs.send(data.toString());
          }
        }
      } catch (error) {
        logger.error('Failed to process browser message', error as Error, { sessionId });
      }
    });

    clientWs.on('error', (error: Error) => {
      logger.error('Browser WebSocket error', error, { sessionId });

      // Cleanup extraction interval on error
      if (extractionInterval) {
        clearInterval(extractionInterval);
        extractionInterval = null;
        logger.info('[EXTRACTION] Cleared extraction interval due to Browser error (Web)', {
          sessionId,
          callId,
        });
      }
    });

    clientWs.on('close', () => {
      logger.info('Browser WebSocket closed', { sessionId });

      // Cleanup extraction interval
      if (extractionInterval) {
        clearInterval(extractionInterval);
        extractionInterval = null;
        logger.info('[EXTRACTION] Cleared extraction interval on Browser close (Web)', {
          sessionId,
          callId,
        });
      }

      if (elevenLabsWs) {
        elevenLabsWs.close();
      }

      // Clean up stored session
      if (sessionId) {
        this.activeWebSessions.delete(sessionId);
        logger.info('Cleaned up web session', { sessionId });
      }
    });
  }

  terminateWebSession(
    sessionId: string,
    reason: string = 'Operator takeover',
    closeClient: boolean = true
  ): boolean {
    const session = this.activeWebSessions.get(sessionId);

    if (!session) {
      logger.warn('Attempted to terminate non-existent session', { sessionId });
      return false;
    }

    logger.info('Terminating web session', {
      sessionId,
      callId: session.callId,
      reason,
      closeClient,
    });

    // Notify client about AI termination
    try {
      session.clientWs.send(
        JSON.stringify({
          type: closeClient ? 'session_terminated' : 'ai_terminated',
          reason,
          message: closeClient
            ? 'Appel terminé'
            : 'Un opérateur humain a pris le contrôle de cet appel',
        })
      );
    } catch (error) {
      logger.error('Failed to notify client of termination', error as Error, { sessionId });
    }

    // Set flag to keep client connected if requested (BEFORE closing ElevenLabs)
    if (!closeClient) {
      session.keepClientConnected = true;
      logger.info('Flag set: client will be kept connected after AI termination', { sessionId });
    }

    // Close ElevenLabs connection (AI)
    if (session.elevenLabsWs) {
      try {
        session.elevenLabsWs.close();
      } catch (error) {
        logger.error('Failed to close ElevenLabs WebSocket', error as Error, { sessionId });
      }
    }

    // Close client connection only if requested
    if (closeClient) {
      try {
        session.clientWs.close();
      } catch (error) {
        logger.error('Failed to close client WebSocket', error as Error, { sessionId });
      }

      // Remove from active sessions only if client is closed
      this.activeWebSessions.delete(sessionId);

      // Broadcast session ended event to dashboard
      this.broadcastSessionEnded(session.callId, sessionId, reason).catch((err) => {
        logger.error('Failed to broadcast session ended event', err as Error);
      });
    } else {
      // If client stays connected, update session to mark AI as terminated
      session.elevenLabsWs = null;
      logger.info('AI terminated, client WebSocket kept open for operator takeover', {
        sessionId,
      });
    }

    logger.info('Web session terminated successfully', { sessionId, closeClient });
    return true;
  }

  getActiveSessions(): Array<{ sessionId: string; callId: string }> {
    return Array.from(this.activeWebSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      callId: s.callId,
    }));
  }

  findSessionByCallId(callId: string): string | null {
    for (const [sessionId, session] of this.activeWebSessions.entries()) {
      if (session.callId === callId) {
        return sessionId;
      }
    }
    return null;
  }

  private async broadcastSessionStarted(callId: string, sessionId: string): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventBus = container.getEventBus();

      // Note: phoneNumber not available from callService.getCallById without patient include
      // For now we broadcast without it
      await eventBus.publish(new WebSessionStartedEvent(callId, sessionId, undefined));

      logger.info('Broadcasted WebSessionStartedEvent', { callId, sessionId });
    } catch (error) {
      logger.error('Failed to broadcast WebSessionStartedEvent', error as Error, {
        callId,
        sessionId,
      });
      throw error;
    }
  }

  private async broadcastSessionEnded(
    callId: string,
    sessionId: string,
    reason: string
  ): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventBus = container.getEventBus();

      await eventBus.publish(new WebSessionEndedEvent(callId, sessionId, reason));

      logger.info('Broadcasted WebSessionEndedEvent', { callId, sessionId, reason });
    } catch (error) {
      logger.error('Failed to broadcast WebSessionEndedEvent', error as Error, {
        callId,
        sessionId,
        reason,
      });
      throw error;
    }
  }

  async handleOperatorConnection(
    operatorWs: FastifyWebSocket,
    request: FastifyRequest
  ): Promise<void> {
    await this.initialize();

    const query = request.query as { handoffId?: string; sessionId?: string };
    const handoffId = query.handoffId;
    const sessionId = query.sessionId;

    if (!handoffId && !sessionId) {
      logger.error('Operator connection missing handoffId or sessionId');
      operatorWs.close();
      return;
    }

    logger.info('Operator WebSocket connected', { handoffId, sessionId });

    // Audio buffers pour transcription par batch (réduit les appels API)
    const operatorAudioBuffer: Buffer[] = [];
    const patientAudioBuffer: Buffer[] = [];
    let operatorBufferTimeout: NodeJS.Timeout | null = null;
    let patientBufferTimeout: NodeJS.Timeout | null = null;
    const TRANSCRIBE_BATCH_MS = 3000; // Transcrire tous les 3 secondes

    // Helper pour transcrire un batch d'audio
    const transcribeBatch = async (
      audioChunks: Buffer[],
      speaker: 'operator' | 'patient',
      callId: string
    ): Promise<void> => {
      if (audioChunks.length === 0) {
        return;
      }

      try {
        // Combiner tous les chunks en un seul buffer
        const combinedBuffer = Buffer.concat(audioChunks);

        // Transcrire via ElevenLabs STT
        const result = await elevenLabsSTTService.transcribeAudioChunk(combinedBuffer, {
          callId,
          speaker,
          sessionId: sessionId || '',
        });

        if (result && result.text.trim()) {
          logger.info('Audio transcribed', {
            speaker,
            text: result.text,
            callId,
          });

          // Sauvegarder la transcription dans call.transcript (source de vérité complète)
          const speakerLabel = speaker === 'operator' ? 'Operator' : 'User';
          await callService.appendTranscript(callId, `${speakerLabel}: ${result.text}`);

          // Envoyer la transcription à l'opérateur pour affichage
          if (operatorWs.readyState === 1) {
            operatorWs.send(
              JSON.stringify({
                type: 'transcript',
                speaker,
                text: result.text,
                timestamp: new Date().toISOString(),
              })
            );
          }
        }

        // Clear le buffer
        audioChunks.length = 0;
      } catch (error) {
        logger.error('Failed to transcribe audio batch', error as Error, {
          speaker,
          callId,
        });
      }
    };

    try {
      // Récupérer le handoff
      let handoff: Awaited<ReturnType<typeof handoffService.getHandoffById>> | undefined;

      if (handoffId) {
        handoff = await handoffService.getHandoffById(handoffId);
      }

      if (!handoff && !sessionId) {
        logger.error('Handoff not found', new Error('Handoff not found'), { handoffId });
        operatorWs.send(
          JSON.stringify({
            type: 'error',
            message: 'Handoff not found',
          })
        );
        operatorWs.close();
        return;
      }

      // Récupérer la session patient active via le callId du handoff
      let patientSession:
        | (typeof this.activeWebSessions extends Map<string, infer V> ? V : never)
        | undefined = undefined;

      if (handoff) {
        // Chercher la session par callId
        const callId = handoff.callId;
        for (const [sid, session] of this.activeWebSessions.entries()) {
          if (session.callId === callId) {
            patientSession = session;
            logger.info('Found patient session for handoff', { sessionId: sid, callId });
            break;
          }
        }
      }

      if (!patientSession && handoff) {
        logger.error('Patient session not found for handoff', new Error('Session not active'), {
          callId: handoff.callId,
          handoffId: handoff.id,
        });
        operatorWs.send(
          JSON.stringify({
            type: 'error',
            message: 'Patient session not found or already ended',
          })
        );
        operatorWs.close();
        return;
      }

      // Envoyer les infos de contexte à l'opérateur
      if (handoff) {
        operatorWs.send(
          JSON.stringify({
            type: 'handoff_context',
            data: {
              callId: handoff.callId,
              transcript: handoff.transcript,
              patientSummary: handoff.patientSummary,
              reason: handoff.reason,
              aiContext: handoff.aiContext,
            },
          })
        );

        logger.info('Handoff context sent to operator', { handoffId });

        // Marquer le handoff comme IN_PROGRESS
        await handoffService.updateHandoffStatus(handoff.id, 'IN_PROGRESS');
      }

      // Notifier l'opérateur qu'il est connecté
      operatorWs.send(
        JSON.stringify({
          type: 'connected',
          status: 'ready',
          message: 'Vous êtes connecté au patient. Vous pouvez maintenant parler.',
          sessionId,
        })
      );

      logger.info('Operator ready to talk with patient', { handoffId, sessionId });
      // ROUTING AUDIO BIDIRECTIONNEL OPERATOR ↔ PATIENT
      // 1. Audio OPERATOR → PATIENT
      operatorWs.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'audio' && message.audio_base_64) {
            // Convertir base64 en buffer
            const audioBuffer = Buffer.from(message.audio_base_64, 'base64');

            // Ajouter au buffer pour transcription
            operatorAudioBuffer.push(audioBuffer);

            // Reset le timer de transcription
            if (operatorBufferTimeout) {
              clearTimeout(operatorBufferTimeout);
            }
            operatorBufferTimeout = setTimeout(async () => {
              await transcribeBatch(operatorAudioBuffer, 'operator', patientSession?.callId || '');
            }, TRANSCRIBE_BATCH_MS);

            // Forward audio au patient
            if (patientSession && patientSession.clientWs.readyState === 1) {
              patientSession.clientWs.send(
                JSON.stringify({
                  type: 'operator_audio',
                  audio_base_64: message.audio_base_64,
                })
              );
            }

            logger.info('Operator audio forwarded to patient', {
              handoffId,
              audioLength: audioBuffer.length,
            });
          }

          if (message.type === 'end_handoff') {
            logger.info('Operator ending handoff', { handoffId });

            // Transcrire les buffers restants
            await transcribeBatch(operatorAudioBuffer, 'operator', patientSession?.callId || '');
            await transcribeBatch(patientAudioBuffer, 'patient', patientSession?.callId || '');

            if (handoff) {
              await handoffService.updateHandoffStatus(handoff.id, 'COMPLETED');

              // Update call status
              await callService.updateCallStatus(handoff.callId, 'COMPLETED');
            }

            // Fermer la session patient
            if (patientSession) {
              patientSession.clientWs.send(
                JSON.stringify({
                  type: 'session_terminated',
                  reason: 'Operator ended handoff',
                })
              );
              patientSession.clientWs.close();
              this.activeWebSessions.delete(sessionId!);
            }

            operatorWs.close();
          }
        } catch (error) {
          logger.error('Failed to process operator message', error as Error, { handoffId });
        }
      });

      // 2. Audio PATIENT → OPERATOR
      if (patientSession) {
        patientSession.clientWs.on('message', async (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());

            if (message.type === 'audio' && message.audio_base_64) {
              // Convertir base64 en buffer
              const audioBuffer = Buffer.from(message.audio_base_64, 'base64');

              // Ajouter au buffer pour transcription
              patientAudioBuffer.push(audioBuffer);

              // Reset le timer de transcription
              if (patientBufferTimeout) {
                clearTimeout(patientBufferTimeout);
              }
              patientBufferTimeout = setTimeout(async () => {
                await transcribeBatch(patientAudioBuffer, 'patient', patientSession.callId);
              }, TRANSCRIBE_BATCH_MS);

              // Forward audio à l'opérateur
              if (operatorWs.readyState === 1) {
                operatorWs.send(
                  JSON.stringify({
                    type: 'patient_audio',
                    audio_base_64: message.audio_base_64,
                  })
                );
              }

              logger.info('Patient audio forwarded to operator', {
                handoffId,
                audioLength: audioBuffer.length,
              });
            }
          } catch (error) {
            logger.error('Failed to process patient message', error as Error, { handoffId });
          }
        });
      }

      operatorWs.on('close', async () => {
        logger.info('Operator WebSocket closed', { handoffId, sessionId });

        // Transcrire les buffers restants
        await transcribeBatch(operatorAudioBuffer, 'operator', patientSession?.callId || '');
        await transcribeBatch(patientAudioBuffer, 'patient', patientSession?.callId || '');

        // Clear les timers
        if (operatorBufferTimeout) {
          clearTimeout(operatorBufferTimeout);
        }
        if (patientBufferTimeout) {
          clearTimeout(patientBufferTimeout);
        }

        if (handoff && handoff.status === 'IN_PROGRESS') {
          await handoffService.updateHandoffStatus(handoff.id, 'COMPLETED');
        }
      });

      operatorWs.on('error', (error: Error) => {
        logger.error('Operator WebSocket error', error, { handoffId, sessionId });
      });
    } catch (error) {
      logger.error('Failed to initialize operator connection', error as Error, { handoffId });
      operatorWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Failed to initialize connection',
        })
      );
      operatorWs.close();
    }
  }
}

// Singleton
export const twilioElevenLabsProxyService = new TwilioElevenLabsProxyService();
