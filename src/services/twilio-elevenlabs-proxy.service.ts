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

/**
 * Service proxy WebSocket entre Twilio Media Stream et ElevenLabs Conversational AI
 *
 * Architecture:
 * Twilio Media Stream → Notre WebSocket → ElevenLabs WebSocket
 *
 * Flow:
 * 1. Twilio envoie audio (Media Stream format, mulaw 8kHz)
 * 2. On convertit et forward à ElevenLabs
 * 3. ElevenLabs retourne audio + transcription
 * 4. On forward à Twilio
 */
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

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const secrets = await loadSecrets();
    this.apiKey = secrets.elevenlabsApiKey;
    this.agentId = process.env.ELEVENLABS_AGENT_ID || '';

    if (!this.agentId) {
      throw new Error('ELEVENLABS_AGENT_ID not configured');
    }

    this.initialized = true;
    logger.info('Twilio-ElevenLabs Proxy Service initialized');
  }

  /**
   * Méthode statique pour récupérer le callId depuis un conversationId
   * Utilisée par les tools ElevenLabs qui reçoivent conversationId dans les webhooks
   */
  static getCallIdFromConversation(conversationId: string): string | undefined {
    return this.conversationToCallMap.get(conversationId);
  }

  /**
   * Stocker le mapping conversationId → callId
   */
  private storeConversationMapping(conversationId: string, callId: string): void {
    TwilioElevenLabsProxyService.conversationToCallMap.set(conversationId, callId);
    logger.info('Stored conversation mapping', { conversationId, callId });
  }

  /**
   * Handle incoming Twilio Media Stream WebSocket connection
   */
  async handleTwilioConnection(twilioWs: FastifyWebSocket, request: FastifyRequest): Promise<void> {
    await this.initialize();

    const callSid = (request.query as { callSid?: string }).callSid;
    logger.info('Twilio Media Stream connected', { callSid });

    let elevenLabsWs: WebSocket | null = null;
    let callId: string | null = null;
    let streamSid: string | null = null;

    // Connect to ElevenLabs WebSocket
    try {
      const elevenLabsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${this.agentId}`;

      elevenLabsWs = new WebSocket(elevenLabsUrl, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      logger.info('Connecting to ElevenLabs WebSocket', { callSid });

      // ElevenLabs → Twilio: Forward audio responses
      elevenLabsWs.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          logger.debug('ElevenLabs message received', {
            type: message.type,
            callSid,
          });

          // Capturer le conversation_id d'ElevenLabs et le mapper au callId
          if (message.conversation_id && callId) {
            this.storeConversationMapping(message.conversation_id, callId);
          }

          // Forward audio to Twilio
          if (message.type === 'audio' && message.audio_event) {
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

          // Log transcript
          if (message.type === 'transcript' && message.transcript_event) {
            logger.info('ElevenLabs transcript', {
              text: message.transcript_event.text,
              role: message.transcript_event.role,
              callSid,
            });
          }
        } catch (error) {
          logger.error('Failed to process ElevenLabs message', error as Error, { callSid });
        }
      });

      elevenLabsWs.on('error', (error: Error) => {
        logger.error('ElevenLabs WebSocket error', error, { callSid });
      });

      elevenLabsWs.on('close', () => {
        logger.info('ElevenLabs WebSocket closed', { callSid });
        twilioWs.close();
      });
    } catch (error) {
      logger.error('Failed to connect to ElevenLabs', error as Error, { callSid });
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
        if (message.event === 'media' && elevenLabsWs) {
          const audioPayload = message.media.payload;

          // Forward to ElevenLabs
          // Note: Twilio sends mulaw 8kHz, might need conversion
          elevenLabsWs.send(
            JSON.stringify({
              type: 'audio',
              audio_event: {
                audio_base_64: audioPayload,
                // encoding: 'mulaw_8000', // Check ElevenLabs docs for format
              },
            })
          );
        }

        // Handle stream stop
        if (message.event === 'stop') {
          logger.info('Twilio Media Stream stopped', { streamSid, callSid });

          if (elevenLabsWs) {
            elevenLabsWs.close();
          }

          // Update call status
          if (callId) {
            await callService.updateCallStatus(callId, 'COMPLETED');
          }
        }
      } catch (error) {
        logger.error('Failed to process Twilio message', error as Error, { callSid });
      }
    });

    twilioWs.on('error', (error: Error) => {
      logger.error('Twilio WebSocket error', error, { callSid });
    });

    twilioWs.on('close', () => {
      logger.info('Twilio WebSocket closed', { callSid });

      if (elevenLabsWs) {
        elevenLabsWs.close();
      }
    });
  }

  /**
   * Handle incoming Web Browser WebSocket connection
   * Architecture: Browser → Notre WebSocket → ElevenLabs WebSocket
   */
  async handleWebConnection(clientWs: FastifyWebSocket, request: FastifyRequest): Promise<void> {
    await this.initialize();

    const query = request.query as { sessionId?: string; callId?: string };
    const sessionId = query.sessionId;
    const callId = query.callId || null;

    logger.info('Web conversation connected', { sessionId, callId });

    let elevenLabsWs: WebSocket | null = null;

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

        // Envoyer le message d'initialisation à ElevenLabs avec callId
        elevenLabsWs!.send(
          JSON.stringify({
            type: 'conversation_initiation_client_data',
            custom_llm_extra_body: {
              callId: callId, // Accessible dans tous les tools
            },
          })
        );

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

        // Notify client that connection is ready
        clientWs.send(JSON.stringify({ type: 'connected', status: 'ready' }));
      });

      // ElevenLabs → Browser: Forward all messages
      elevenLabsWs.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          logger.debug('ElevenLabs message received', {
            type: message.type,
            sessionId,
          });

          // Capturer le conversation_id d'ElevenLabs et le mapper au callId
          if (message.conversation_id && callId) {
            this.storeConversationMapping(message.conversation_id, callId);
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

          // Log transcript
          if (message.type === 'user_transcript' && message.user_transcription_event) {
            logger.info('User transcript', {
              text: message.user_transcription_event.user_transcript,
              sessionId,
            });
          }

          if (message.type === 'agent_response' && message.agent_response_event) {
            logger.info('Agent response', {
              text: message.agent_response_event.agent_response,
              sessionId,
            });
          }
        } catch (error) {
          logger.error('Failed to process ElevenLabs message', error as Error, { sessionId });
        }
      });

      elevenLabsWs.on('error', (error: Error) => {
        logger.error('ElevenLabs WebSocket error', error, { sessionId });
      });

      elevenLabsWs.on('close', () => {
        logger.info('ElevenLabs WebSocket closed', { sessionId });

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
    });

    clientWs.on('close', () => {
      logger.info('Browser WebSocket closed', { sessionId });

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

  /**
   * Terminate an active web session (used when operator takes control)
   * @param closeClient - If false, keeps the client WebSocket open for operator takeover
   */
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

  /**
   * Get active sessions (for debugging/monitoring)
   */
  getActiveSessions(): Array<{ sessionId: string; callId: string }> {
    return Array.from(this.activeWebSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      callId: s.callId,
    }));
  }

  /**
   * Find session by callId (used for operator takeover by callId)
   */
  findSessionByCallId(callId: string): string | null {
    for (const [sessionId, session] of this.activeWebSessions.entries()) {
      if (session.callId === callId) {
        return sessionId;
      }
    }
    return null;
  }

  /**
   * Broadcast session started event to dashboard
   */
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

  /**
   * Broadcast session ended event to dashboard
   */
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

  /**
   * Handle incoming Operator WebSocket connection
   * Architecture: Operator → Notre WebSocket → Patient (direct, pas d'ElevenLabs)
   *
   * Utilisé quand un opérateur prend la main après un handoff
   */
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
    const operatorBufferTimeout: NodeJS.Timeout | null = null;
    const patientBufferTimeout: NodeJS.Timeout | null = null;
    // TODO: Réactiver quand transcription sera corrigée
    // const TRANSCRIBE_BATCH_MS = 3000; // Transcrire tous les 3 secondes

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

          // Sauvegarder la transcription dans la conversation
          // TODO: Créer une méthode dans callService pour append transcript
          // await callService.appendTranscript(callId, speaker, result.text);

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

      // ====================
      // ROUTING AUDIO BIDIRECTIONNEL OPERATOR ↔ PATIENT
      // ====================

      // 1. Audio OPERATOR → PATIENT
      operatorWs.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'audio' && message.audio_base_64) {
            // Convertir base64 en buffer
            const audioBuffer = Buffer.from(message.audio_base_64, 'base64');

            // TODO: Temporairement désactivé - format audio à corriger
            // Ajouter au buffer pour transcription
            // operatorAudioBuffer.push(audioBuffer);

            // Reset le timer de transcription
            // if (operatorBufferTimeout) {
            //   clearTimeout(operatorBufferTimeout);
            // }
            // operatorBufferTimeout = setTimeout(async () => {
            //   await transcribeBatch(operatorAudioBuffer, 'operator', patientSession?.callId || '');
            // }, TRANSCRIBE_BATCH_MS);

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

              // TODO: Temporairement désactivé - format audio à corriger
              // Ajouter au buffer pour transcription
              // patientAudioBuffer.push(audioBuffer);

              // Reset le timer de transcription
              // if (patientBufferTimeout) {
              //   clearTimeout(patientBufferTimeout);
              // }
              // patientBufferTimeout = setTimeout(async () => {
              //   await transcribeBatch(patientAudioBuffer, 'patient', patientSession.callId);
              // }, TRANSCRIBE_BATCH_MS);

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
