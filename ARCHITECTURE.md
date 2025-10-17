# Architecture SAMU AI - Documentation Technique

**Version**: 2.0 (Post-refactoring)
**Date**: 2025-10-17
**Status**: Production Ready

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Clean Architecture Layers](#clean-architecture-layers)
4. [Services Layer](#services-layer)
5. [Flow d'un Appel d'Urgence](#flow-dun-appel-durgence)
6. [Base de Données](#base-de-données)
7. [APIs & Endpoints](#apis--endpoints)
8. [Déploiement](#déploiement)

---

## Vue d'Ensemble

**SAMU AI Triage System** est un système de pré-triage téléphonique automatisé pour les appels d'urgence SAMU. Il utilise l'IA conversationnelle (ElevenLabs + Claude 3.5 Sonnet) pour :

- Interagir vocalement avec les appelants
- Évaluer l'urgence médicale (protocole ABCD)
- Dispatcher automatiquement les secours SMUR (P0/P1)
- Gérer une file d'attente pour les cas non-urgents (P2-P4)
- Escalader vers médecin régulateur si nécessaire

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PATIENT / APPELANT                          │
│                              Appel 15                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ELEVENLABS CONVERSATIONAL AI                       │
│                                                                      │
│  Agent ID: agent_4601k7mndj62fe4s0yja4hy7pek0                       │
│  Voice: Rachel (French)                                              │
│  Model: Claude 3.5 Sonnet via Anthropic API                         │
│                                                                      │
│  Capabilities:                                                       │
│  - Natural language understanding                                    │
│  - ABCD medical assessment                                           │
│  - Client Tools integration (dispatch, analyze, etc.)               │
└────────────────┬─────────────────────────────────────┬──────────────┘
                 │                                     │
                 │ Client Tools HTTP Requests          │ Webhook Events
                 ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  BACKEND API (Fastify + TypeScript)                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API LAYER (src/api/routes/)                                 │  │
│  │                                                                │  │
│  │  • POST /api/v1/test/dispatch-smur         ← Client Tool     │  │
│  │  • POST /api/v1/test/analyze-abcd          ← Client Tool     │  │
│  │  • POST /api/v1/test/queue-call            ← Client Tool     │  │
│  │  • POST /api/v1/test/request-handoff       ← Client Tool     │  │
│  │  • POST /api/v1/test/take-control          ← Dashboard       │  │
│  │  • GET  /api/v1/test/active-calls          ← Dashboard       │  │
│  │  • POST /api/v1/twilio/webhook             ← Twilio          │  │
│  └────────────────────┬─────────────────────────────────────────┘  │
│                       │                                              │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │  SERVICE LAYER (src/services/)                               │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐ │  │
│  │  │ DispatchService  │  │  QueueService    │  │HandoffService│ │  │
│  │  │                  │  │                  │  │             │ │  │
│  │  │ • createDispatch │  │ • addToQueue     │  │• request     │ │  │
│  │  │ • updateStatus   │  │ • claimEntry     │  │• accept      │ │  │
│  │  │ • listDispatches │  │ • getStats       │  │• takeControl │ │  │
│  │  │ • getMapData     │  │ • listQueue      │  │             │ │  │
│  │  └──────────────────┘  └──────────────────┘  └─────────────┘ │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │  │
│  │  │  CallService     │  │TriageService     │                  │  │
│  │  │                  │  │                  │                  │  │
│  │  │ • create         │  │ • analyze        │                  │  │
│  │  │ • update         │  │ • classify       │                  │  │
│  │  │ • getActiveCalls │  │ • saveReport     │                  │  │
│  │  └──────────────────┘  └──────────────────┘                  │  │
│  └────────────────────┬─────────────────────────────────────────┘  │
│                       │                                              │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │  DATA LAYER (Prisma ORM)                                     │  │
│  │                                                                │  │
│  │  • Type-safe database queries                                 │  │
│  │  • Transaction management                                     │  │
│  │  • Migration system                                           │  │
│  └────────────────────┬─────────────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│            POSTGRESQL 16 + pgvector                                  │
│                                                                      │
│  Tables:                                                             │
│  • Call                  - Emergency call sessions                   │
│  • Patient               - Patient information (hashed phone)        │
│  • TriageReport          - ABCD assessment + priority                │
│  • Dispatch              - SMUR dispatch tracking                    │
│  • Queue                 - Call queue for P2-P4                      │
│  • Handoff               - AI→Human escalations                      │
│  • ElevenLabsConversation - Full conversation logs                   │
│  • AuditLog              - GDPR compliance                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Clean Architecture Layers

Le code suit une **architecture hexagonale** stricte avec 3 layers :

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: API / PRESENTATION                                        │
│  src/api/routes/                                                     │
│                                                                      │
│  Responsabilités:                                                    │
│  • Validation des requêtes HTTP (Zod schemas)                       │
│  • Sérialisation/Désérialisation JSON                               │
│  • Gestion des codes HTTP (200, 400, 500)                           │
│  • Logging des requêtes                                             │
│  • Rate limiting                                                     │
│                                                                      │
│  NE DOIT PAS: Contenir de logique métier                            │
│  NE DOIT PAS: Accéder directement à Prisma                          │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ Calls
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: BUSINESS LOGIC / SERVICES                                 │
│  src/services/                                                       │
│                                                                      │
│  Responsabilités:                                                    │
│  • Implémentation de la logique métier                              │
│  • Orchestration des opérations complexes                           │
│  • Validation des règles business                                   │
│  • Gestion des transactions                                         │
│  • Calculs et algorithmes                                           │
│                                                                      │
│  Exemple: DispatchService.createDispatch()                          │
│     → Vérifie priorité P0/P1                                        │
│     → Crée Call si nécessaire                                       │
│     → Crée Dispatch avec geolocation                                │
│     → Log audit                                                     │
│                                                                      │
│  NE DOIT PAS: Gérer HTTP (codes, headers)                           │
│  NE DOIT PAS: Connaître l'existence de Fastify/Express              │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ Uses
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3: DATA ACCESS / PERSISTENCE                                 │
│  src/utils/prisma.ts                                                 │
│                                                                      │
│  Responsabilités:                                                    │
│  • Requêtes SQL (via Prisma)                                        │
│  • Gestion de la connexion DB                                       │
│  • Migrations et schema                                             │
│  • Connection pooling                                               │
│                                                                      │
│  NE DOIT PAS: Contenir de logique métier                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Exemple Concret: Dispatch SMUR

**AVANT (logique dans la route)** :
```typescript
// src/api/routes/test.routes.ts (MAUVAIS)
app.post('/dispatch-smur', async (request, reply) => {
  const { priority, location, symptoms } = request.body;

  // Business logic dans la route
  if (priority !== 'P0' && priority !== 'P1') {
    return reply.status(400).send({ error: 'Invalid priority' });
  }

  // Accès direct à Prisma depuis la route
  const dispatch = await prisma.dispatch.create({
    data: { priority, location, symptoms }
  });

  return reply.send({ dispatchId: dispatch.id });
});
```

**APRÈS (clean architecture)** :
```typescript
// src/api/routes/test.routes.ts (BIEN)
app.post('/dispatch-smur', async (request, reply) => {
  // Validation HTTP uniquement
  const input = CreateDispatchSchema.parse(request.body);

  // Délégation au service
  const dispatch = await dispatchService.createDispatch(input);

  // Réponse HTTP
  return reply.send({
    success: true,
    dispatchId: dispatch.id
  });
});

// src/services/dispatch.service.ts (BIEN)
export class DispatchService {
  async createDispatch(input: CreateDispatchInput) {
    // Validation business
    if (!['P0', 'P1'].includes(input.priority)) {
      throw new Error('Only P0/P1 can dispatch SMUR');
    }

    // Logique métier
    const call = await this.getOrCreateCall(input.callId);

    // Persistence via Prisma
    const dispatch = await prisma.dispatch.create({
      data: {
        callId: call.id,
        priority: input.priority,
        location: input.location,
        symptoms: input.symptoms,
        status: 'PENDING'
      }
    });

    // Audit log
    logger.info('SMUR dispatched', { dispatchId: dispatch.id });

    return dispatch;
  }
}
```

---

## Services Layer

### 1. DispatchService
**Fichier**: `src/services/dispatch.service.ts`

```typescript
class DispatchService {
  // Créer un dispatch SMUR (P0/P1 uniquement)
  async createDispatch(input: CreateDispatchInput): Promise<Dispatch>

  // Mettre à jour le statut (PENDING → DISPATCHED → EN_ROUTE → COMPLETED)
  async updateDispatchStatus(input: UpdateDispatchStatusInput): Promise<Dispatch>

  // Lister tous les dispatches (avec filtres optionnels)
  async listDispatches(filters?: DispatchFilters): Promise<Dispatch[]>

  // Récupérer les dispatches pour la carte (avec coordonnées GPS)
  async getMapDispatches(filters?: DispatchFilters): Promise<MapDispatch[]>
}
```

**Cas d'usage**:
- Agent détecte arrêt cardiaque → `dispatchService.createDispatch({ priority: 'P0', ... })`
- SMUR confirme départ → `updateDispatchStatus({ id, status: 'EN_ROUTE' })`
- Dashboard map → `getMapDispatches()` pour heatmap

---

### 2. QueueService
**Fichier**: `src/services/queue.service.ts`

```typescript
class QueueService {
  // Ajouter un appel en file d'attente (P2/P3/P4)
  async addToQueue(input: CreateQueueEntryInput): Promise<Queue>

  // Lister la queue (triée par priorité + temps d'attente)
  async listQueue(filters?: QueueFilters): Promise<Queue[]>

  // Médecin régulateur prend un appel de la queue
  async claimQueueEntry(input: ClaimQueueEntryInput): Promise<Queue>

  // Stats temps réel (count par statut, temps d'attente moyen)
  async getQueueStats(): Promise<QueueStats>
}
```

**Cas d'usage**:
- Agent classifie P3 → `queueService.addToQueue({ callId, priority: 'P3', ... })`
- Dashboard régulateur → `listQueue({ status: 'PENDING' })` trié par priorité
- Médecin clique "Prendre l'appel" → `claimQueueEntry({ queueId, operatorId })`

---

### 3. HandoffService
**Fichier**: `src/services/handoff.service.ts`

```typescript
class HandoffService {
  // L'AI demande transfert vers humain
  async requestHandoff(input: CreateHandoffInput): Promise<Handoff>

  // Médecin accepte le handoff
  async acceptHandoff(handoffId: string): Promise<Handoff>

  // Prise de contrôle instantanée (dashboard)
  async takeControl(input: TakeControlInput): Promise<Handoff>
}
```

**Cas d'usage**:
- Agent incertain → `requestHandoff({ callId, reason: 'Symptômes ambigus' })`
- Dashboard notif → Médecin clique "Accepter" → `acceptHandoff(handoffId)`
- Urgence dashboard → Médecin clique "Prendre contrôle" → `takeControl()`

---

### 4. CallService
**Fichier**: `src/services/call.service.ts`

```typescript
class CallService {
  async createCall(input: CreateCallInput): Promise<Call>
  async updateCall(callId: string, data: UpdateCallData): Promise<Call>
  async getActiveCalls(): Promise<Call[]>  // IN_PROGRESS + ESCALATED
}
```

---

## Flow d'un Appel d'Urgence

```
┌────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: APPEL ENTRANT                                             │
└────────────────────────────────────────────────────────────────────┘
    Patient appelle le 15
    ↓
    callService.createCall({ patientPhone: hash('+336...') })
    ↓
    Call créé en DB (status: IN_PROGRESS)


┌────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: CONVERSATION AI (ElevenLabs)                              │
└────────────────────────────────────────────────────────────────────┘
    AI: "Bonjour SAMU, quelle est votre urgence?"
    Patient: "Mon père ne respire plus!"

    AI collecte:
    ├─ Symptômes (breathing: "absent", consciousness: "unresponsive")
    ├─ Localisation exacte
    ├─ Antécédents médicaux
    └─ Protocole ABCD

    triageService.analyze() → Priority: P0 (Arrêt cardiaque)


┌────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: DÉCISION AUTOMATIQUE                                      │
└────────────────────────────────────────────────────────────────────┘
    if (priority === 'P0' || priority === 'P1') {
        ┌─────────────────────────────────────┐
        │ DISPATCH SMUR IMMÉDIAT              │
        │                                     │
        │ dispatchService.createDispatch({    │
        │   priority: 'P0',                   │
        │   location: '15 rue Victor Hugo',   │
        │   symptoms: 'Arrêt cardiaque'       │
        │ })                                  │
        │                                     │
        │ → SMUR dispatché automatiquement    │
        │ → ETA: 8-12 minutes                 │
        └─────────────────────────────────────┘
    }

    else if (priority === 'P2' || priority === 'P3' || priority === 'P4') {
        ┌─────────────────────────────────────┐
        │ FILE D'ATTENTE                      │
        │                                     │
        │ queueService.addToQueue({           │
        │   callId,                           │
        │   priority: 'P2',                   │
        │   aiSummary: '...',                 │
        │   keySymptoms: [...],               │
        │   redFlags: [...]                   │
        │ })                                  │
        │                                     │
        │ → Ajouté en queue pour médecin      │
        │ → Position: 3ème (P2 < P3 < P4)     │
        └─────────────────────────────────────┘
    }

    else if (priority === 'P5') {
        ┌─────────────────────────────────────┐
        │ CONSEIL MÉDICAL                     │
        │                                     │
        │ AI donne conseil direct:            │
        │ "Prenez 1g paracétamol. Si fièvre  │
        │  persiste >39°C, rappelez le 15"    │
        │                                     │
        │ → Pas de dispatch                   │
        │ → Pas de queue                      │
        └─────────────────────────────────────┘
    }


┌────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4 (OPTIONNELLE): ESCALADE HUMAINE                            │
└────────────────────────────────────────────────────────────────────┘
    Si AI incertaine OU médecin prend contrôle:

    handoffService.requestHandoff({
        callId,
        reason: 'Symptômes contradictoires',
        transcript: '...',
        aiContext: { ... }
    })
    ↓
    Dashboard notifie médecin régulateur disponible
    ↓
    Médecin accepte → handoffService.acceptHandoff(handoffId)
    ↓
    Call passe en status: ESCALATED
    ↓
    Médecin continue la conversation


┌────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: FIN D'APPEL                                                │
└────────────────────────────────────────────────────────────────────┘
    callService.updateCall(callId, {
        status: 'COMPLETED',
        endedAt: new Date(),
        transcript: fullTranscript
    })
    ↓
    AuditLog créé (GDPR compliance)
    ↓
    Analytics mis à jour
```

---

## Base de Données

### Schema Prisma

```prisma
model Call {
  id              String    @id @default(cuid())
  patientId       String
  patient         Patient   @relation(fields: [patientId])

  status          CallStatus @default(IN_PROGRESS)
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  duration        Int?      // secondes

  transcript      String?   @db.Text

  triageReport    TriageReport?
  dispatches      Dispatch[]
  queueEntry      Queue?
  handoffs        Handoff[]
  elevenLabsConversation ElevenLabsConversation?
}

model Dispatch {
  id              String    @id @default(cuid())
  dispatchId      String    @unique  // "SMUR-1760695184933"

  callId          String
  call            Call      @relation(fields: [callId])

  priority        PriorityLevel
  location        String
  symptoms        String    @db.Text

  status          DispatchStatus @default(PENDING)

  // Geolocation
  latitude        Float?
  longitude       Float?

  // Timestamps
  requestedAt     DateTime  @default(now())
  dispatchedAt    DateTime?
  arrivedAt       DateTime?
  completedAt     DateTime?

  // Metrics
  responseTime    Int?      // secondes
}

model Queue {
  id              String    @id @default(cuid())
  callId          String    @unique
  call            Call      @relation(fields: [callId])

  priority        PriorityLevel  // P2, P3, P4

  // AI-generated summary
  chiefComplaint  String
  aiSummary       String    @db.Text
  aiRecommendation String   @db.Text
  keySymptoms     String[]
  redFlags        String[]

  status          QueueStatus @default(PENDING)

  addedAt         DateTime  @default(now())
  claimedAt       DateTime?
  claimedBy       String?   // operatorId
}

model Handoff {
  id              String    @id @default(cuid())
  callId          String
  call            Call      @relation(fields: [callId])

  toOperatorId    String
  reason          String    @db.Text

  conversationId  String?
  transcript      String    @db.Text
  aiContext       Json      // Contexte AI au moment du handoff
  patientSummary  String    @db.Text

  status          HandoffStatus @default(REQUESTED)

  requestedAt     DateTime  @default(now())
  acceptedAt      DateTime?
}

enum CallStatus {
  IN_PROGRESS
  COMPLETED
  CANCELLED
  ESCALATED
}

enum DispatchStatus {
  PENDING
  DISPATCHED
  EN_ROUTE
  ON_SCENE
  COMPLETED
  CANCELLED
}

enum QueueStatus {
  PENDING
  CLAIMED
  COMPLETED
}

enum HandoffStatus {
  REQUESTED
  ACCEPTED
  REJECTED
}

enum PriorityLevel {
  P0  // Absolute emergency (cardiac arrest)
  P1  // Life-threatening
  P2  // Urgent
  P3  // Semi-urgent
  P4  // Non-urgent
  P5  // Medical advice
}
```

---

## APIs & Endpoints

### Client Tools (ElevenLabs → Backend)

```http
POST /api/v1/test/dispatch-smur
Content-Type: application/json

{
  "priority": "P0",
  "location": "15 rue Victor Hugo, Lyon 69002",
  "symptoms": "Arrêt cardiaque suspecté, patient inconscient",
  "patientPhone": "+33612345678",
  "callId": "call_xyz" // optionnel
}

Response 200:
{
  "success": true,
  "dispatchId": "SMUR-1760695184933",
  "message": "Les secours SMUR sont en route. ETA: 8-12 minutes."
}
```

```http
POST /api/v1/test/queue-call
Content-Type: application/json

{
  "callId": "call_abc123",
  "priority": "P2",
  "chiefComplaint": "Douleur thoracique modérée",
  "aiSummary": "Patient 45 ans, douleur thoracique depuis 30min...",
  "aiRecommendation": "Consultation médecin régulateur recommandée",
  "keySymptoms": ["chest_pain", "mild_dyspnea"],
  "redFlags": []
}

Response 200:
{
  "success": true,
  "queueId": "queue_xyz",
  "position": 3,
  "estimatedWaitTime": 12
}
```

### Dashboard API

```http
GET /api/v1/test/active-calls

Response 200:
{
  "success": true,
  "count": 5,
  "calls": [
    {
      "id": "call_abc",
      "patient": { "age": 45, "gender": "M" },
      "status": "IN_PROGRESS",
      "triageReport": { "priority": "P2" },
      "handoffs": [],
      "startedAt": "2025-10-17T10:00:00Z"
    }
  ]
}
```

```http
POST /api/v1/test/take-control
Content-Type: application/json

{
  "callId": "call_abc123",
  "operatorId": "operator_xyz",
  "reason": "Prise de contrôle manuelle depuis dashboard"
}

Response 200:
{
  "success": true,
  "handoffId": "handoff_xyz",
  "message": "Vous avez pris le contrôle de l'appel"
}
```

---

## Déploiement

### Docker Compose (Local)

```bash
# Lancer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f app

# Health check
curl http://localhost:3000/health
```

### Google Cloud Run (Production)

```bash
# Build et push
gcloud builds submit --config cloudbuild.yaml

# Déployer
gcloud run deploy samu-ai-backend \
  --image gcr.io/samu-ai-474822/backend:latest \
  --region europe-west1 \
  --platform managed
```

**Variables d'environnement** (Google Secret Manager):
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key
- `TWILIO_ACCOUNT_SID` - Twilio credentials
- `TWILIO_AUTH_TOKEN` - Twilio credentials

---

## Métriques & Monitoring

### KPIs Techniques
- Latency API < 200ms (p95)
- Uptime > 99.9%
- DB queries < 100ms
- Error rate < 0.1%

### KPIs Business
- Taux dispatch approprié: 15-25%
- Durée appel moyenne: < 5min
- Précision triage: > 85%
- Temps attente queue: < 10min

---

## Sécurité & Compliance

### GDPR
- Phone numbers hashed (SHA256)
- Audit log for all data access
- Data retention policies (30 days conversations, 5 years dispatches)
- Right to access/delete

### Medical Compliance
- ABCD protocol validated by medical professionals
- All AI decisions logged with reasoning
- Human oversight for critical decisions (P0/P1)

---

## Ressources

- **Code**: [GitHub Repository]
- **API Docs**: http://localhost:3000/docs (Swagger)
- **Dashboard**: http://localhost:3000/dashboard-conversations.html
- **Health Check**: http://localhost:3000/health

---

**Dernière mise à jour**: 2025-10-17
**Auteur**: SAMU AI Team
**Version**: 2.0 (Post-Clean Architecture Refactoring)
