<div align="center">

# SAMU AI Triage System

### *Next-Generation Emergency Medical Triage powered by Conversational AI*

[![CI/CD Pipeline](https://github.com/BitBricoleurs/backend-google-hackathon/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/BitBricoleurs/backend-google-hackathon/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Google Cloud](https://img.shields.io/badge/Cloud-Google%20Cloud-4285F4?logo=google-cloud)](https://cloud.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Deployment](#deployment)

</div>

---

## Overview

**SAMU AI Triage** is an enterprise-grade, AI-powered medical emergency triage system designed for SAMU (French Emergency Medical Services) to reduce wait times during peak hours through intelligent pre-triage and medical information collection.

The system provides:
- **Autonomous conversational AI agent** handling inbound phone calls via Twilio
- **Medical triage** using Gemini 2.5 Flash + ElevenLabs Conversational AI
- **WHO ABCD protocol** implementation (Airway-Breathing-Circulation-Disability)
- **Structured triage reports** with priority classification (P0-P4)
- **Auto-dispatch** of SMUR for P0/P1 emergencies
- **Seamless handoff** to human operators when needed
- **Real-time dashboards** with WebSocket updates for medical coordinators

---

## Features

### **AI-Powered Voice Triage**
- **Natural conversation** in French via phone (Twilio + ElevenLabs)
- **Real-time speech-to-text** with voice activity detection (VAD)
- **Gemini 2.5 Flash** for medical reasoning and triage logic
- **Context-aware** follow-up questions based on symptoms
- **Sentiment analysis** to detect patient distress levels

### **Medical Intelligence**
- **ABCD Protocol Implementation** (WHO Emergency Triage Assessment)
  - **A**irway obstruction detection
  - **B**reathing rate & SpO2 evaluation
  - **C**irculation assessment (pulse, chest pain, bleeding)
  - **D**isability/Consciousness (AVPU scale)
- **Priority Classification**: P0 (immediate) → P4 (advice)
- **Red Flag Detection**: Automatic identification of life-threatening symptoms
- **Patient History**: Retrieves past calls, chronic conditions, allergies
- **Pharmacy on Duty**: Location-based pharmacy recommendations

### **Dispatch & Queue Management**
- **Auto-dispatch SMUR** for P0/P1 cases (< 30 seconds decision time)
- **Intelligent queueing** system for P2/P3/P4 cases
- **Operator availability tracking** (AVAILABLE/BUSY/OFFLINE)
- **Contextual handoff** with full conversation transcript + AI analysis
- **Real-time coordination** via WebSocket dashboards

### **Security & Compliance**
- **GDPR-compliant**: Phone numbers hashed (SHA-256), no PII logging
- **HDS-ready**: Audit logs, data encryption, access control
- **Role-based access control** (RBAC): OPERATOR, ADMIN roles
- **JWT authentication** with Redis-backed token storage
- **Encrypted secrets** via Google Cloud Secret Manager

### **Real-Time Monitoring**
- **Live dashboards** with WebSocket (operator status, queue depth, dispatches)
- **Conversation persistence** (ElevenLabs transcripts + audio in GCS)
- **Metrics & Analytics** (call volume, triage distribution, response times)
- **Structured logging** (JSON format with correlation IDs)
- **Health checks** (/health, /health/live, /health/ready)

### **Production-Ready**
- **Comprehensive test suite** (Vitest + Testcontainers)
- **TypeScript strict mode** (zero `any` types)
- **CI/CD pipeline** (GitHub Actions + Google Cloud Build)
- **Docker containerization** with multi-stage builds
- **Horizontal scaling** (stateless architecture, Redis pub/sub)
- **Zero-downtime deployments** (Cloud Run blue/green)

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SAMU AI Triage System                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌──────────────────────────────────────────────────┐
│   Patient   │─────▶│  Twilio Phone Network (Inbound Call)             │
│  (Caller)   │      └──────────────────────────────────────────────────┘
└─────────────┘                        │
                                       │ Media Stream (WebSocket)
                                       ▼
                      ┌──────────────────────────────────┐
                      │  Twilio ↔ ElevenLabs Proxy       │
                      │  (src/services/twilio-elevenlabs-│
                      │   proxy.service.ts)              │
                      └──────────────────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    ▼                                      ▼
         ┌─────────────────────┐              ┌──────────────────────┐
         │  ElevenLabs Conv AI │              │   Twilio Media       │
         │  (Voice STT/TTS)    │              │   (Audio Stream)     │
         └─────────────────────┘              └──────────────────────┘
                    │
                    │ Webhooks (Client Tools)
                    ▼
         ┌─────────────────────────────────────────────────┐
         │         Fastify Backend (Node.js 20)            │
         ├─────────────────────────────────────────────────┤
         │  ┌──────────────┐    ┌──────────────────────┐  │
         │  │   API Routes │    │  WebSocket Gateways  │  │
         │  │  (Fastify)   │    │  (Real-time Updates) │  │
         │  └──────────────┘    └──────────────────────┘  │
         │                                                 │
         │  ┌──────────────────────────────────────────┐  │
         │  │         Service Layer                    │  │
         │  │  • call.service.ts                       │  │
         │  │  • dispatch.service.ts                   │  │
         │  │  • handoff.service.ts                    │  │
         │  │  • queue.service.ts                      │  │
         │  │  • elevenlabs-conversations.service.ts   │  │
         │  └──────────────────────────────────────────┘  │
         │                                                 │
         │  ┌──────────────────────────────────────────┐  │
         │  │    ElevenLabs Client Tools               │  │
         │  │  1. dispatch_smur (P0/P1 auto-dispatch)  │  │
         │  │  2. get_patient_history                  │  │
         │  │  3. get_pharmacy_on_duty                 │  │
         │  └──────────────────────────────────────────┘  │
         └─────────────────────────────────────────────────┘
                    │                          │
        ┌───────────┴──────────┐   ┌──────────┴────────────┐
        ▼                      ▼   ▼                       ▼
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ PostgreSQL16 │    │  Redis 7         │    │ Google Cloud       │
│  (Prisma)    │    │  (Cache/PubSub)  │    │ Storage (Audio)    │
│              │    │                  │    │ Secret Manager     │
└──────────────┘    └──────────────────┘    └────────────────────┘
```

### Technology Stack

#### **Backend Core**
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.6 (strict mode, no `any`)
- **Framework**: Fastify (HTTP/WebSocket)
- **Architecture**: Service Layer Pattern + Domain Events

#### **AI & Telephony**
- **Conversational AI**: ElevenLabs (integrated STT/TTS/VAD)
- **LLM**: Gemini 2.5 Flash (via ElevenLabs)
- **Medical Analysis**: Gemini 2.5 Flash (info extraction & triage)
- **Telephony**: Twilio Programmable Voice + Media Streams
- **Audio Processing**: μ-law 8000 Hz (telephony standard)

#### **Data Layer**
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Caching**: Redis 7 (cache + pub/sub event bus)
- **Storage**: Google Cloud Storage (audio recordings)
- **Secrets**: Google Cloud Secret Manager

#### **Infrastructure**
- **Container**: Docker (multi-stage builds)
- **Orchestration**: Google Cloud Run (auto-scaling)
- **CI/CD**: GitHub Actions + Google Cloud Build
- **Monitoring**: Structured logging (JSON), Health checks

#### **Testing & Quality**
- **Test Framework**: Vitest
- **Test Coverage**: Comprehensive test suite with Testcontainers
- **Containers**: Testcontainers (isolated DB tests)
- **Linting**: ESLint + Prettier (strict)
- **Type Safety**: TypeScript strict mode

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20.0.0
- **PostgreSQL** 16
- **Redis** 7+
- **Docker** (optional, for containerized dev)

### Installation

```bash
# Clone repository
git clone https://github.com/BitBricoleurs/backend-google-hackathon.git
cd backend-google-hackathon

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys (Twilio, ElevenLabs, etc.)

# Generate Prisma Client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Server running at `http://localhost:8080`

### Docker Compose (Recommended for Development)

```bash
docker-compose up
```

This starts:
- **App** (port 8080)
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)

---

## Documentation

### Project Structure

```
src/
├── api/
│   ├── routes/              # HTTP endpoints (Fastify)
│   │   ├── calls.routes.ts
│   │   ├── twilio.routes.ts
│   │   ├── operators.routes.ts
│   │   ├── queue.routes.ts
│   │   └── transcripts.routes.ts
│   ├── middleware/          # Auth, RBAC, Rate limiting
│   └── validation/          # Zod schemas
│
├── services/                # Business logic (Service Layer)
│   ├── call.service.ts
│   ├── dispatch.service.ts
│   ├── handoff.service.ts
│   ├── queue.service.ts
│   ├── operator.service.ts
│   ├── twilio-elevenlabs-proxy.service.ts
│   └── elevenlabs-conversations.service.ts
│
├── tools/                   # ElevenLabs Client Tools (AI-callable)
│   ├── dispatch-smur.tool.ts
│   ├── get-patient-history.tool.ts
│   └── get-pharmacy-on-duty.tool.ts
│
├── presentation/
│   └── websocket/           # Real-time WebSocket gateways
│       └── RealtimeDashboard.gateway.ts
│
├── domain/                  # Domain entities + events
│   ├── call/
│   ├── operator/
│   └── triage/
│
├── infrastructure/
│   ├── di/                  # Dependency Injection Container
│   ├── messaging/           # Redis Event Bus
│   ├── caching/             # Redis Cache
│   └── repositories/        # Prisma repositories
│
├── config/                  # Configuration (Zod validated)
├── types/                   # TypeScript type definitions
└── utils/                   # Logger, helpers
```

### Key Endpoints

#### **Health Checks**
```http
GET /health              # Full health check (DB + Redis)
GET /health/live         # Liveness probe (K8s compatible)
GET /health/ready        # Readiness probe (K8s compatible)
```

#### **Twilio Integration**
```http
POST /api/v1/twilio/inbound           # Inbound call webhook (TwiML)
POST /api/v1/twilio/post-call-webhook # Post-call analytics
```

#### **Calls API**
```http
POST /api/v1/calls/start-web          # Start web-based call (signed URL)
GET  /api/v1/calls/:id                # Get call details
```

#### **Transcripts**
```http
GET /api/v1/transcripts/:callId           # Get conversation transcript
GET /api/v1/transcripts/:callId/formatted # Human-readable format
```

#### **Queue Management**
```http
GET  /api/v1/queue                    # List queue entries
POST /api/v1/queue/:id/claim          # Operator claims call
```

#### **ElevenLabs Tools (Webhooks)**
```http
POST /api/v1/tools/get_patient_history    # Patient history lookup
POST /api/v1/tools/get_pharmacy_on_duty   # Pharmacy finder
POST /api/v1/test/dispatch-smur           # SMUR dispatch (P0/P1)
```

### Database Schema

**Core Models**:
- `Call` - Emergency call session
- `Patient` - Patient info (phone hashed, GDPR-compliant)
- `Operator` - Human operators (status tracking)
- `QueueEntry` - Waiting queue for non-urgent calls
- `Handoff` - AI → Human transfers with context
- `TriageReport` - ABCD assessment + priority
- `Dispatch` - SMUR/ambulance dispatch records
- `ElevenLabsConversation` - Conversation metadata + transcript

### Environment Variables

Required variables (store in Google Secret Manager for production):

```env
# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/samu

# Redis
REDIS_URL=redis://localhost:6379

# ElevenLabs
ELEVENLABS_API_KEY=sk_xxxxx
ELEVENLABS_AGENT_ID=agent_xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+33xxxxxxxxx

# Google Cloud (optional for local dev)
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json
PUBLIC_API_URL=https://your-domain.app
```

---

## Deployment

### Google Cloud Run (Production)

#### **Prerequisites**

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Login and set project
gcloud auth login
gcloud config set project samu-ai-474822
```

#### **Setup Secrets**

```bash
# Upload secrets to Secret Manager
./scripts/upload-secrets-to-google.sh
```

#### **Deploy**

```bash
# Deploy to Cloud Run (auto-builds from Dockerfile)
./scripts/deploy-google-cloud.sh

# Or use Cloud Build (CI/CD)
gcloud builds submit --config cloudbuild.yaml
```

#### **CI/CD Pipeline**

GitHub Actions automatically deploys on push:
- `dev` branch → `samu-ai-triage-staging`
- `production` branch → `samu-ai-triage-production`

### Terraform (Infrastructure as Code)

Infrastructure defined in `terraform/`:

```bash
cd terraform/environments/production
terraform init
terraform plan
terraform apply
```

Resources provisioned:
- Cloud Run service
- Cloud SQL (PostgreSQL)
- Redis (Cloud Memorystore)
- Secret Manager
- Service Accounts + IAM
- VPC Connector (for private DB)

---

## Testing

### Run Tests

```bash
# All tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# UI mode (interactive)
npm run test:ui

# Specific file
npm run test src/services/call.service.test.ts
```

### Test Suite

Our comprehensive test suite includes:
- **Unit tests**: Service layer and business logic
- **Integration tests**: Database and external APIs
- **Route tests**: API endpoint validation
- **Isolated testing**: Testcontainers for PostgreSQL

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('CallService', () => {
  beforeEach(() => {
    // Setup test database with Testcontainers
  });

  it('should create call with hashed phone number', async () => {
    const call = await callService.createCall({
      phoneNumber: '+33612345678'
    });
    expect(call.patient.phoneHash).toBeDefined();
    expect(call.status).toBe('IN_PROGRESS');
  });
});
```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Hot-reload dev server
npm run build            # Production build
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma Client (MUST run after schema changes!)
npm run db:migrate       # Create and apply migrations
npm run db:studio        # Prisma Studio UI
npm run db:push          # Push schema (dev only)

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # Auto-fix lint issues
npm run format           # Prettier format
npm run format:check     # Check formatting
npm run type-check       # TypeScript compilation check
npm run validate         # Run all checks (type + lint + format + test)

# Docker
npm run docker:build     # Build Docker image
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
```

### Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature
git commit -m "feat(scope): description"
git push origin feature/your-feature
# Open PR → dev branch

# Hotfix
git checkout -b hotfix/critical-bug
git commit -m "fix(scope): description"
# PR → production (emergency) or dev (normal)
```

**Commit Convention**: Conventional Commits (feat, fix, docs, chore, refactor, test)

---

## Security

### GDPR Compliance

- **No PII in logs**: Phone numbers hashed with SHA-256
- **Data retention**: Configurable TTL for calls/transcripts
- **Right to erasure**: Delete patient data on request
- **Audit trails**: All data access logged

### Authentication & Authorization

- **JWT tokens** (access + refresh)
- **RBAC**: OPERATOR, ADMIN roles
- **Redis token storage** (logout all devices support)
- **API key auth** for ElevenLabs tools

### Infrastructure Security

- **Secrets management**: Google Cloud Secret Manager
- **Network isolation**: VPC Connector for DB
- **Encryption at rest**: Cloud SQL automatic encryption
- **Encryption in transit**: HTTPS/TLS everywhere
- **Service accounts**: Least-privilege IAM roles

---

## Team

**Google Hackathon 2025** - Built by the SAMU AI Team

### Contributors

- **Alexandre Lagasse** ([@alexandrelagasse](https://github.com/alexandrelagasse))
- **Harry Viennot** ([@harryviennot](https://github.com/harryviennot))
- **Bartosz** ([@Bartoszkk](https://github.com/Bartoszkk))
- **Théophilus Homawoo** ([@theohmwoa](https://github.com/theohmwoa))
- **Clément Lagasse** ([@ClementLagasse](https://github.com/ClementLagasse))

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Google** - Gemini 2.5 Flash LLM & Google Cloud Platform
- **ElevenLabs** - Conversational AI platform
- **Twilio** - Programmable voice infrastructure
- **Fastify** - High-performance web framework
- **Prisma** - Next-generation ORM

---

## Support

- **Issues**: [GitHub Issues](https://github.com/BitBricoleurs/backend-google-hackathon/issues)
- **Repository**: [github.com/BitBricoleurs/backend-google-hackathon](https://github.com/BitBricoleurs/backend-google-hackathon)

---

<div align="center">

**Star this repo if you find it useful!**

Made for SAMU and emergency medical services worldwide

</div>
