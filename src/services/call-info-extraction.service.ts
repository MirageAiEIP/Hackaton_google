import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { logger } from '@/utils/logger';
import { callService } from './call.service';
import { Container } from '@/infrastructure/di/Container';
import { CallInfoUpdatedEvent } from '@/domain/call/events/CallInfoUpdated.event';
import { getGoogleCredentialsPath } from '@/utils/google-credentials';

/**
 * Service pour extraire automatiquement les informations structurées
 * depuis le transcript d'une conversation avec Gemini via Vertex AI
 *
 * Utilise le compte de service Google Cloud (fichier JSON dans config/)
 */
export class CallInfoExtractionService {
  private vertexAI: VertexAI | null = null;
  private model: GenerativeModel | null = null;

  async initialize(): Promise<void> {
    if (this.model) {
      return;
    }

    // Auto-détection du fichier credentials dans config/
    const keyFilename = getGoogleCredentialsPath();
    const projectId =
      process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'hackathon-google-451307';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west1';

    if (!keyFilename) {
      throw new Error(
        'Google credentials file not found in config/ directory. Please add a service account JSON file.'
      );
    }

    logger.info('Using Vertex AI with service account credentials', {
      keyFilename,
      projectId,
      location,
    });

    // Utiliser Vertex AI avec le service account
    this.vertexAI = new VertexAI({
      project: projectId,
      location,
      googleAuthOptions: {
        keyFilename,
      },
    });

    this.model = this.vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite', // Modèle léger et rapide pour extraction
    });

    logger.info('Call Info Extraction Service initialized with Vertex AI', {
      projectId,
      location,
      model: 'gemini-2.5-flash-lite',
      credentialsPath: keyFilename,
    });
  }

  /**
   * Extrait les informations structurées depuis un transcript de conversation
   */
  async extractCallInfo(params: { callId: string; transcript: string }): Promise<{
    success: boolean;
    extracted: {
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
    };
  }> {
    logger.info('[GEMINI] Initializing Vertex AI...', { callId: params.callId });
    await this.initialize();

    const { callId, transcript } = params;

    logger.info('[GEMINI] Starting extraction with Gemini via Vertex AI', {
      callId,
      transcriptLength: transcript.length,
      transcriptWords: transcript.split(' ').length,
    });

    try {
      const prompt = `Tu es un expert médical du SAMU 15. Analyse ce transcript d'appel d'urgence et extrais TOUTES les informations disponibles au format JSON.

TRANSCRIPT:
${transcript}

INSTRUCTIONS:
- Extrais UNIQUEMENT les informations explicitement mentionnées dans le transcript
- Si une information n'est pas mentionnée, ne l'inclus PAS dans le JSON
- Pour la priorité, évalue selon le protocole ABCD :
  * P0 = urgence absolue (arrêt cardiaque, inconscient sans respiration)
  * P1 = urgence vitale (AVC, douleur thoracique intense, détresse respiratoire sévère)
  * P2 = urgence (traumatisme, douleur intense, fièvre avec altération)
  * P3 = conseil médical (symptômes légers)
- Pour consciousness, utilise l'échelle AVPU : Alert, Verbal, Pain, Unresponsive

FORMAT DE RÉPONSE (JSON uniquement, sans markdown):
{
  "age": number ou null,
  "gender": "M" | "F" | "Autre" ou null,
  "address": "adresse complète avec étage et code" ou null,
  "city": "ville" ou null,
  "postalCode": "code postal" ou null,
  "priority": "P0" | "P1" | "P2" | "P3" ou null,
  "priorityReason": "explication détaillée de la priorité" ou null,
  "chiefComplaint": "motif principal en une phrase" ou null,
  "currentSymptoms": "description détaillée de tous les symptômes" ou null,
  "consciousness": "Alert" | "Verbal" | "Pain" | "Unresponsive" ou null
}`;

      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      logger.info('[GEMINI] Sending prompt to Gemini...', {
        callId,
        promptLength: prompt.length,
      });

      const startTime = Date.now();
      const result = await this.model.generateContent(prompt);
      const duration = Date.now() - startTime;

      logger.info('[GEMINI] Received response from Gemini', {
        callId,
        durationMs: duration,
      });

      const response = result.response;

      // Extraire le texte depuis la réponse Vertex AI
      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts?.[0]?.text) {
        logger.warn('[GEMINI] No text in Vertex AI response', {
          callId,
          hasResponse: !!response,
          hasCandidates: !!response.candidates,
          candidatesLength: response.candidates?.length || 0,
        });
        throw new Error('No text in Vertex AI response');
      }

      const text = candidate.content.parts[0].text;

      logger.info('[GEMINI] Text extracted from response', {
        callId,
        responseLength: text.length,
        responsePreview: text.substring(0, 200) + '...',
      });

      // Parse JSON (enlever les backticks markdown si présents)
      let jsonText = text.trim();
      const hadMarkdown = jsonText.startsWith('```');
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      logger.info('[GEMINI] Parsing JSON response...', {
        callId,
        hadMarkdown,
        jsonLength: jsonText.length,
      });

      const extracted = JSON.parse(jsonText);

      logger.info('[GEMINI] JSON parsed successfully', {
        callId,
        rawFields: Object.keys(extracted),
        rawFieldsCount: Object.keys(extracted).length,
      });

      // Nettoyer les valeurs nulles
      const cleanedExtracted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(extracted)) {
        if (value !== null && value !== undefined && value !== '') {
          cleanedExtracted[key] = value;
        }
      }

      logger.info('[GEMINI] Extraction completed successfully', {
        callId,
        fieldsExtracted: Object.keys(cleanedExtracted),
        fieldsCount: Object.keys(cleanedExtracted).length,
        extractedData: cleanedExtracted,
      });

      return {
        success: true,
        extracted: cleanedExtracted as typeof extracted,
      };
    } catch (error) {
      logger.error('[GEMINI] Failed to extract call info', error as Error, {
        callId,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      });
      return {
        success: false,
        extracted: {},
      };
    }
  }

  /**
   * Extrait et met à jour automatiquement les informations du call
   */
  async extractAndUpdateCall(params: {
    callId: string;
    transcript: string;
    call?: Awaited<ReturnType<typeof callService.getCallById>>; // Éviter double fetch
  }): Promise<{
    success: boolean;
    updated: string[];
  }> {
    const { callId, transcript, call: providedCall } = params;

    logger.info('[UPDATE] Starting extraction and update process', { callId });

    // Extraire les infos
    const extractionResult = await this.extractCallInfo({ callId, transcript });

    if (!extractionResult.success) {
      logger.warn('[UPDATE] Extraction failed, aborting update', { callId });
      return {
        success: false,
        updated: [],
      };
    }

    const { extracted } = extractionResult;
    const updated: string[] = [];

    logger.info('[UPDATE] Extraction successful, preparing database updates', {
      callId,
      extractedFields: Object.keys(extracted),
    });

    try {
      // Utiliser le call fourni ou le récupérer (éviter double fetch)
      let call = providedCall;
      if (!call) {
        logger.info('[UPDATE] Fetching call from database...', { callId });
        call = await callService.getCallById(callId);
      } else {
        logger.debug('[UPDATE] Using provided call object (no extra fetch)', { callId });
      }

      if (!call) {
        logger.warn('[UPDATE] Call not found in database', { callId });
        throw new Error(`Call ${callId} not found`);
      }

      logger.info('[UPDATE] Call found', {
        callId,
        patientId: call.patientId,
        hasPatient: !!call.patientId,
      });

      // Préparer les updates pour le patient
      if (call.patientId) {
        const patientUpdates: Record<string, unknown> = {};

        if (extracted.age !== undefined) {
          patientUpdates.age = extracted.age;
          updated.push('age');
        }
        if (extracted.gender !== undefined) {
          patientUpdates.gender = extracted.gender;
          updated.push('gender');
        }
        if (extracted.address !== undefined) {
          patientUpdates.address = extracted.address;
          updated.push('address');
        }
        if (extracted.city !== undefined) {
          patientUpdates.city = extracted.city;
          updated.push('city');
        }
        if (extracted.postalCode !== undefined) {
          patientUpdates.postalCode = extracted.postalCode;
          updated.push('postalCode');
        }

        if (Object.keys(patientUpdates).length > 0) {
          logger.info('[UPDATE] Updating patient info in database...', {
            callId,
            patientId: call.patientId,
            fields: Object.keys(patientUpdates),
            updates: patientUpdates,
          });

          await callService.updatePatientInfo(call.patientId, patientUpdates);

          logger.info('[UPDATE] Patient info successfully updated', {
            callId,
            patientId: call.patientId,
            updatedFields: Object.keys(patientUpdates),
          });
        } else {
          logger.debug('[UPDATE] No patient fields to update', { callId });
        }
      } else {
        logger.debug('[UPDATE] No patient associated with call', { callId });
      }

      // Préparer les updates pour le call
      const callUpdates: Record<string, unknown> = {};

      if (extracted.priority !== undefined) {
        callUpdates.priority = extracted.priority;
        updated.push('priority');
      }
      if (extracted.priorityReason !== undefined) {
        callUpdates.priorityReason = extracted.priorityReason;
        updated.push('priorityReason');
      }
      if (extracted.chiefComplaint !== undefined) {
        callUpdates.chiefComplaint = extracted.chiefComplaint;
        updated.push('chiefComplaint');
      }
      if (extracted.currentSymptoms !== undefined) {
        callUpdates.currentSymptoms = extracted.currentSymptoms;
        updated.push('currentSymptoms');
      }
      if (extracted.consciousness !== undefined) {
        callUpdates.vitalSigns = { consciousness: extracted.consciousness };
        updated.push('consciousness');
      }

      if (Object.keys(callUpdates).length > 0) {
        logger.info('[UPDATE] Updating call info in database...', {
          callId,
          fields: Object.keys(callUpdates),
          updates: callUpdates,
        });

        await callService.updateCallFields(callId, callUpdates);

        logger.info('[UPDATE] Call info successfully updated', {
          callId,
          updatedFields: Object.keys(callUpdates),
          priority: extracted.priority,
        });
      } else {
        logger.debug('[UPDATE] No call fields to update', { callId });
      }

      logger.info('[UPDATE] Extraction and update process completed successfully', {
        callId,
        totalFieldsUpdated: updated.length,
        updatedFields: updated,
        summary: {
          patient: updated.filter((f) =>
            ['age', 'gender', 'address', 'city', 'postalCode'].includes(f)
          ),
          call: updated.filter(
            (f) => !['age', 'gender', 'address', 'city', 'postalCode'].includes(f)
          ),
        },
      });

      // Broadcast update to WebSocket dashboard if fields were updated
      if (updated.length > 0) {
        try {
          const container = Container.getInstance();
          const eventBus = container.getEventBus();

          await eventBus.publish(new CallInfoUpdatedEvent(callId, updated, extracted));

          logger.info('[WEBSOCKET] Broadcasted CallInfoUpdatedEvent to dashboard', {
            callId,
            updatedFields: updated,
          });
        } catch (error) {
          logger.error('[WEBSOCKET] Failed to broadcast CallInfoUpdatedEvent', error as Error, {
            callId,
          });
          // Don't fail the whole operation if broadcast fails
        }
      }

      return {
        success: true,
        updated,
      };
    } catch (error) {
      logger.error('[UPDATE] Failed to update call with extracted info', error as Error, {
        callId,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      });
      return {
        success: false,
        updated: [],
      };
    }
  }
}

export const callInfoExtractionService = new CallInfoExtractionService();
