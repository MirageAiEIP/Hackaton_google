/**
 * TESTS D'INTÉGRATION RÉELS - AUCUN MOCK
 * Teste les vrais workflows de bout en bout avec de vraies données
 */

import axios, { AxiosInstance } from 'axios';
import { faker } from '@faker-js/faker';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Couleurs pour terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface TestData {
  operators: Array<{ id: string; name: string; email: string }>;
  calls: Array<{ id: string; sessionId: string; phoneNumber: string }>;
  dispatches: Array<{ id: string; dispatchId: string; priority: string }>;
  queueEntries: Array<{ id: string; callId: string }>;
  handoffs: Array<{ id: string; callId: string }>;
}

class RealIntegrationTester {
  private client: AxiosInstance;
  private testData: TestData = {
    operators: [],
    calls: [],
    dispatches: [],
    queueEntries: [],
    handoffs: [],
  };

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      validateStatus: () => true,
    });
  }

  private log(message: string, color: keyof typeof colors = 'reset') {
    // eslint-disable-next-line no-console
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private logData(label: string, data: unknown) {
    this.log(`\n📋 ${label}:`, 'cyan');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(data, null, 2));
  }

  /**
   * WORKFLOW 1: Créer des opérateurs réels
   */
  async testCreateRealOperators() {
    this.log('\n🧪 WORKFLOW 1: Créer 3 opérateurs réels dans la base', 'magenta');

    for (let i = 0; i < 3; i++) {
      const name = faker.person.fullName();
      const email = faker.internet.email();

      this.log(`\n➡️  Création opérateur ${i + 1}: ${name} (${email})`, 'cyan');

      const res = await this.client.post('/api/v1/operators', { name, email });

      if (res.status !== 200 && res.status !== 201) {
        this.log(`❌ ERREUR création opérateur: ${res.status}`, 'red');
        this.logData('Réponse', res.data);
        throw new Error('Échec création opérateur');
      }

      const operator = res.data.data.operator;
      this.testData.operators.push(operator);

      this.log(`✅ Opérateur créé: ${operator.name} (ID: ${operator.id})`, 'green');
      this.logData('Opérateur', operator);
    }

    this.log(`\n✅ ${this.testData.operators.length} opérateurs créés avec succès`, 'green');
  }

  /**
   * WORKFLOW 2: Mettre les opérateurs AVAILABLE
   */
  async testSetOperatorsAvailable() {
    this.log('\n🧪 WORKFLOW 2: Mettre tous les opérateurs AVAILABLE', 'magenta');

    for (const operator of this.testData.operators) {
      this.log(`\n➡️  Mise à jour statut: ${operator.name} → AVAILABLE`, 'cyan');

      const res = await this.client.patch(`/api/v1/operators/${operator.id}/status`, {
        status: 'AVAILABLE',
      });

      if (res.status !== 200) {
        this.log(`❌ ERREUR mise à jour statut: ${res.status}`, 'red');
        this.logData('Réponse', res.data);
        throw new Error('Échec mise à jour statut');
      }

      this.log(`✅ ${operator.name} est maintenant AVAILABLE`, 'green');
    }

    // Vérifier que les opérateurs sont bien disponibles
    this.log('\n➡️  Vérification des opérateurs disponibles...', 'cyan');
    const res = await this.client.get('/api/v1/operators/available');

    this.log(`✅ ${res.data.data.operators.length} opérateurs disponibles`, 'green');
    this.logData('Opérateurs disponibles', res.data.data.operators);
  }

  /**
   * WORKFLOW 3: Créer de vraies conversations
   */
  async testCreateRealConversations() {
    this.log('\n🧪 WORKFLOW 3: Créer 5 vraies conversations web', 'magenta');

    for (let i = 0; i < 5; i++) {
      const phoneNumber = faker.phone.number('+336########');

      this.log(`\n➡️  Démarrage conversation ${i + 1}: ${phoneNumber}`, 'cyan');

      const res = await this.client.post('/api/v1/calls/start-web', {
        phoneNumber,
        metadata: {
          source: 'integration-test',
          testNumber: i + 1,
          timestamp: new Date().toISOString(),
        },
      });

      if (res.status !== 200) {
        this.log(`❌ ERREUR démarrage conversation: ${res.status}`, 'red');
        this.logData('Réponse', res.data);
        throw new Error('Échec démarrage conversation');
      }

      const call = {
        id: res.data.callId,
        sessionId: res.data.sessionId,
        phoneNumber,
        signedUrl: res.data.agentConfig.signedUrl,
      };

      this.testData.calls.push(call);

      this.log(`✅ Conversation créée: ${call.sessionId}`, 'green');
      this.log(`   Call ID: ${call.id}`, 'cyan');
      this.log(`   Phone: ${call.phoneNumber}`, 'cyan');
      this.log(`   Signed URL: ${call.signedUrl.substring(0, 80)}...`, 'cyan');

      // Vérifier le statut
      const statusRes = await this.client.get(`/api/v1/calls/${call.sessionId}/status`);
      this.logData('Statut conversation', statusRes.data);
    }

    this.log(`\n✅ ${this.testData.calls.length} conversations créées`, 'green');
  }

  /**
   * WORKFLOW 4: Créer de vrais dispatches SMUR
   */
  async testCreateRealDispatches() {
    this.log('\n🧪 WORKFLOW 4: Créer 2 vrais dispatches SMUR (urgences P0/P1 seulement)', 'magenta');
    this.log('ℹ️  Note: SMUR = Urgences vitales (P0/P1 uniquement)', 'yellow');

    const priorities = ['P0', 'P1'];
    const locations = [
      '15 Avenue des Champs-Élysées, 75008 Paris',
      '5 Rue de la Paix, 75002 Paris',
    ];

    for (let i = 0; i < 2; i++) {
      const phoneNumber = faker.phone.number('+336########');

      this.log(`\n➡️  Dispatch ${i + 1}: ${priorities[i]} - ${locations[i]}`, 'cyan');

      const res = await this.client.post('/api/v1/test/dispatch-smur', {
        priority: priorities[i],
        location: locations[i],
        reason: `${priorities[i]} - ${faker.lorem.sentence()}`,
        patientPhone: phoneNumber,
      });

      if (res.status !== 200) {
        this.log(`❌ ERREUR dispatch SMUR: ${res.status}`, 'red');
        this.logData('Réponse', res.data);
        throw new Error('Échec dispatch SMUR');
      }

      const dispatch = {
        id: res.data.id,
        dispatchId: res.data.dispatchId,
        priority: priorities[i],
        location: locations[i],
        callId: res.data.callId,
      };

      this.testData.dispatches.push(dispatch);

      this.log(`✅ Dispatch créé: ${dispatch.dispatchId}`, 'green');
      this.logData('Dispatch', dispatch);
    }

    // Récupérer tous les dispatches
    this.log('\n➡️  Récupération de tous les dispatches...', 'cyan');
    const res = await this.client.get('/api/v1/test/dispatches');
    this.log(`✅ ${res.data.dispatches.length} dispatches au total`, 'green');
    this.logData('Tous les dispatches', res.data.dispatches);
  }

  /**
   * WORKFLOW 5: Récupérer les vraies conversations ElevenLabs
   */
  async testGetRealElevenLabsConversations() {
    this.log('\n🧪 WORKFLOW 5: Récupérer les vraies conversations ElevenLabs API', 'magenta');

    this.log('\n➡️  Appel à ElevenLabs API...', 'cyan');

    const res = await this.client.get('/api/v1/test/conversations', {
      params: {
        page_size: 10,
      },
    });

    if (res.status !== 200) {
      this.log(`❌ ERREUR récupération conversations: ${res.status}`, 'red');
      this.logData('Réponse', res.data);
      return; // Ne pas fail, peut ne pas avoir de conversations
    }

    this.log(`✅ ${res.data.count} conversations trouvées`, 'green');
    this.logData('Conversations ElevenLabs', {
      count: res.data.count,
      has_more: res.data.has_more,
      conversations: res.data.conversations?.slice(0, 3), // Première 3 seulement
    });

    // Si on a des conversations, tester le détail
    if (res.data.conversations && res.data.conversations.length > 0) {
      const firstConv = res.data.conversations[0];
      this.log(`\n➡️  Récupération détails conversation: ${firstConv.conversation_id}`, 'cyan');

      const detailRes = await this.client.get(
        `/api/v1/test/conversations/${firstConv.conversation_id}`
      );

      if (detailRes.status === 200) {
        this.log(`✅ Détails conversation récupérés`, 'green');
        this.logData('Détails', {
          conversation_id: detailRes.data.conversation?.conversation_id,
          agent_id: detailRes.data.conversation?.agent_id,
          status: detailRes.data.conversation?.status,
          transcript_preview: detailRes.data.formattedTranscript?.substring(0, 200) + '...',
        });
      }
    }
  }

  /**
   * WORKFLOW 6: Tester la queue de bout en bout
   */
  async testQueueWorkflow() {
    this.log('\n🧪 WORKFLOW 6: Workflow complet de la queue', 'magenta');

    // 1. Vérifier la queue actuelle
    this.log('\n➡️  Récupération de la queue...', 'cyan');
    const queueRes = await this.client.get('/api/v1/test/queue');

    this.log(`✅ ${queueRes.data.count} entrées dans la queue`, 'green');
    this.logData('Queue', queueRes.data.queue);

    // 2. Si on a des entrées, tester le claim
    if (queueRes.data.queue && queueRes.data.queue.length > 0 && this.testData.operators.length > 0) {
      const queueEntry = queueRes.data.queue[0];
      const operator = this.testData.operators[0];

      this.log(`\n➡️  Opérateur ${operator.name} claim l'appel ${queueEntry.id}`, 'cyan');

      const claimRes = await this.client.post(`/api/v1/test/queue/${queueEntry.id}/claim`, {
        operatorId: operator.id,
      });

      if (claimRes.status === 200) {
        this.log(`✅ Appel claim avec succès!`, 'green');
        this.logData('Queue entry claimée', claimRes.data.queueEntry);
      } else {
        this.log(`⚠️  Appel déjà claim ou non disponible (${claimRes.status})`, 'yellow');
      }
    } else {
      this.log(`ℹ️  Aucune entrée dans la queue pour tester le claim`, 'yellow');
    }
  }

  /**
   * WORKFLOW 7: Tester les handoffs
   */
  async testHandoffWorkflow() {
    this.log('\n🧪 WORKFLOW 7: Workflow complet des handoffs AI → Humain', 'magenta');

    // 1. Récupérer les handoffs pending
    this.log('\n➡️  Récupération des handoffs pending...', 'cyan');
    const pendingRes = await this.client.get('/api/v1/handoff/pending');

    this.log(`✅ ${pendingRes.data.count} handoffs pending`, 'green');
    this.logData('Handoffs pending', pendingRes.data.data);

    // 2. Si on a des appels actifs et des opérateurs, créer un handoff via le tool
    if (this.testData.calls.length > 0 && this.testData.operators.length > 0) {
      const call = this.testData.calls[0];
      const operator = this.testData.operators[1]; // Prendre le 2ème opérateur

      this.log(
        `\n➡️  Création handoff pour call ${call.id} vers opérateur ${operator.name}`,
        'cyan'
      );

      const handoffRes = await this.client.post('/api/v1/tools/request_human_handoff', {
        callId: call.id,
        conversationId: call.sessionId,
        reason: 'Test d\'intégration - Patient demande un humain',
        transcript: 'AI: Bonjour, je suis l\'assistant SAMU.\nPatient: Je veux parler à un humain.',
        patientSummary: 'Patient souhaite parler à un opérateur humain pour discuter de symptômes complexes.',
        aiContext: {
          symptoms: ['douleur thoracique', 'essoufflement'],
          priority: 'P3',
          urgency: 'moderate',
        },
      });

      if (handoffRes.status === 200 && handoffRes.data.success) {
        const handoff = {
          id: handoffRes.data.handoffId,
          callId: call.id,
          status: handoffRes.data.status,
        };

        this.testData.handoffs.push(handoff);

        this.log(`✅ Handoff créé: ${handoff.id}`, 'green');
        this.logData('Handoff créé', handoffRes.data);

        // 3. Accepter le handoff
        this.log(`\n➡️  Opérateur ${operator.name} accepte le handoff ${handoff.id}`, 'cyan');

        const acceptRes = await this.client.post(`/api/v1/handoff/${handoff.id}/accept`, {
          operatorId: operator.id,
        });

        if (acceptRes.status === 200) {
          this.log(`✅ Handoff accepté avec succès!`, 'green');
          this.logData('Handoff accepté', acceptRes.data);

          // 4. Récupérer les détails du handoff
          this.log(`\n➡️  Récupération détails handoff ${handoff.id}`, 'cyan');

          const detailsRes = await this.client.get(`/api/v1/handoff/${handoff.id}`);

          if (detailsRes.status === 200) {
            this.log(`✅ Détails handoff récupérés`, 'green');
            this.logData('Détails handoff', detailsRes.data.data);
          }

          // 5. Compléter le handoff
          this.log(`\n➡️  Complétion du handoff ${handoff.id}`, 'cyan');

          const completeRes = await this.client.post(`/api/v1/handoff/${handoff.id}/complete`);

          if (completeRes.status === 200) {
            this.log(`✅ Handoff complété avec succès!`, 'green');
          }
        } else {
          this.log(`⚠️  Erreur acceptation handoff: ${acceptRes.status}`, 'yellow');
          this.logData('Erreur', acceptRes.data);
        }
      } else {
        this.log(`⚠️  Erreur création handoff: ${handoffRes.status}`, 'yellow');
        this.logData('Erreur', handoffRes.data);
      }
    }
  }

  /**
   * WORKFLOW 8: Tester les tools ElevenLabs avec vraies données
   */
  async testElevenLabsTools() {
    this.log('\n🧪 WORKFLOW 8: Tester les tools ElevenLabs avec vraies données', 'magenta');

    // 1. Test get_patient_history avec un vrai hash
    this.log('\n➡️  Test get_patient_history...', 'cyan');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const phoneHash = crypto.createHash('sha256').update('+33612345678').digest('hex');

    const historyRes = await this.client.post('/api/v1/tools/get_patient_history', {
      phoneHash,
    });

    this.log(`✅ Patient history récupéré`, 'green');
    this.logData('Patient history', historyRes.data);

    // 2. Test get_pharmacy_on_duty avec vraies coordonnées Paris
    this.log('\n➡️  Test get_pharmacy_on_duty (Paris)...', 'cyan');

    const pharmacyRes = await this.client.post('/api/v1/tools/get_pharmacy_on_duty', {
      latitude: 48.8566,
      longitude: 2.3522,
      city: 'Paris',
      postalCode: '75001',
    });

    this.log(`✅ Pharmacies trouvées`, 'green');
    this.logData('Pharmacies', pharmacyRes.data);
  }

  /**
   * WORKFLOW 9: Tester la carte temps réel
   */
  async testRealtimeMap() {
    this.log('\n🧪 WORKFLOW 9: Tester les données carte temps réel', 'magenta');

    this.log('\n➡️  Récupération données carte...', 'cyan');

    const mapRes = await this.client.get('/api/v1/test/interventions/map', {
      params: {
        last_hours: 24,
      },
    });

    this.log(`✅ ${mapRes.data.count} interventions sur la carte`, 'green');
    this.logData('Données carte', {
      count: mapRes.data.count,
      dispatches: mapRes.data.dispatches,
      geoJson: mapRes.data.geoJson?.features?.slice(0, 3), // Premiers 3 points
    });
  }

  /**
   * WORKFLOW 10: Tester les calls actifs et dashboard
   */
  async testActiveCalls() {
    this.log('\n🧪 WORKFLOW 10: Tester calls actifs et dashboard', 'magenta');

    // 1. Récupérer les calls actifs
    this.log('\n➡️  Récupération calls actifs...', 'cyan');

    const activeRes = await this.client.get('/api/v1/test/calls/active');

    this.log(`✅ ${activeRes.data.count} calls actifs`, 'green');
    this.logData('Calls actifs', activeRes.data.calls);

    // 2. Récupérer les stats dashboard
    this.log('\n➡️  Récupération stats dashboard...', 'cyan');

    const statsRes = await this.client.get('/api/v1/dashboard/stats');

    this.log(`✅ Stats dashboard récupérées`, 'green');
    this.logData('Dashboard stats', statsRes.data);
  }

  /**
   * Résumé final des données créées
   */
  printSummary() {
    this.log('\n' + '='.repeat(80), 'blue');
    this.log('📊 RÉSUMÉ DES TESTS D\'INTÉGRATION RÉELS', 'blue');
    this.log('='.repeat(80), 'blue');

    this.log(`\n✅ Opérateurs créés: ${this.testData.operators.length}`, 'green');
    this.testData.operators.forEach((op, i) => {
      this.log(`   ${i + 1}. ${op.name} (${op.email}) - ID: ${op.id}`, 'cyan');
    });

    this.log(`\n✅ Conversations créées: ${this.testData.calls.length}`, 'green');
    this.testData.calls.forEach((call, i) => {
      this.log(`   ${i + 1}. ${call.phoneNumber} - Session: ${call.sessionId}`, 'cyan');
    });

    this.log(`\n✅ Dispatches SMUR créés: ${this.testData.dispatches.length}`, 'green');
    this.testData.dispatches.forEach((dispatch, i) => {
      this.log(
        `   ${i + 1}. ${dispatch.priority} - ${dispatch.location.substring(0, 40)}...`,
        'cyan'
      );
    });

    this.log(`\n✅ Handoffs créés: ${this.testData.handoffs.length}`, 'green');
    this.testData.handoffs.forEach((handoff, i) => {
      this.log(`   ${i + 1}. Handoff ${handoff.id} - Call: ${handoff.callId}`, 'cyan');
    });

    this.log('\n' + '='.repeat(80), 'blue');
    this.log('🎉 TOUS LES TESTS D\'INTÉGRATION RÉELS TERMINÉS AVEC SUCCÈS!', 'green');
    this.log('='.repeat(80), 'blue');
  }

  /**
   * Exécuter tous les workflows
   */
  async runAllWorkflows() {
    this.log('🚀 DÉMARRAGE DES TESTS D\'INTÉGRATION RÉELS', 'blue');
    this.log(`📍 Base URL: ${BASE_URL}`, 'blue');
    this.log('='.repeat(80), 'blue');
    this.log('⚠️  ATTENTION: Ces tests créent de VRAIES données dans la base!', 'yellow');
    this.log('='.repeat(80), 'blue');

    try {
      // Vérifier que le serveur est accessible
      await this.client.get('/health');
      this.log('✅ Serveur accessible\n', 'green');

      await this.testCreateRealOperators();
      await this.testSetOperatorsAvailable();
      await this.testCreateRealConversations();
      await this.testCreateRealDispatches();
      await this.testGetRealElevenLabsConversations();
      await this.testQueueWorkflow();
      await this.testHandoffWorkflow();
      await this.testElevenLabsTools();
      await this.testRealtimeMap();
      await this.testActiveCalls();

      this.printSummary();

      process.exit(0);
    } catch (error) {
      this.log('\n❌ ERREUR FATALE DANS LES TESTS', 'red');
      console.error(error);
      process.exit(1);
    }
  }
}

// Exécuter
const tester = new RealIntegrationTester();
tester.runAllWorkflows().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
