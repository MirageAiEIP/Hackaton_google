# SAMU AI Triage System

AI-powered medical triage system for SAMU emergency calls

[![CI/CD](https://github.com/your-org/samu-ai-triage/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/your-org/samu-ai-triage/actions)
[![codecov](https://codecov.io/gh/your-org/samu-ai-triage/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/samu-ai-triage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This system reduces SAMU wait times during peak hours through a conversational AI agent that performs telephone pre-triage, collects critical medical information, and provides structured dashboards to regulatory physicians.

## Features

- Agent-based conversational AI powered by Claude 3.5 Sonnet (Anthropic)
- ABCD protocol implementation (Airway-Breathing-Circulation-Consciousness)
- Real-time emergency classification (P0-P5 priority levels)
- Medical dashboard with structured triage reports
- GDPR/HDS compliant security
- Comprehensive observability (logs, metrics, tracing)
- Production-ready with Docker, CI/CD, and >80% test coverage

## Technical Stack

- **Backend**: TypeScript + Fastify
- **AI Framework**: Mastra AI
- **Database**: PostgreSQL 16 + pgvector
- **ORM**: Prisma
- **LLM**: Claude 3.5 Sonnet (Anthropic)
- **Testing**: Vitest
- **CI/CD**: GitHub Actions + Google Cloud Build
- **Containerization**: Docker + Google Cloud Run

## Architecture

```
src/
├── agents/          # AI agents (triage, classification)
├── workflows/       # Deterministic workflows (ABCD, routing)
├── tools/           # Agent-callable functions
├── rag/             # Medical knowledge base
├── integrations/    # Telephony, Speech-to-Text
├── api/             # Hono routes and middleware
├── services/        # Business logic
├── models/          # Data models
├── utils/           # Logger, Prisma, helpers
├── config/          # Configuration management
└── types/           # TypeScript type definitions
```

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 16
- npm >= 10.0.0

## Installation

```bash
git clone https://github.com/your-org/samu-ai-triage.git
cd samu-ai-triage

npm install

cp .env.example .env
```

Edit `.env` with your configuration values.

## Database Setup

```bash
docker-compose up -d postgres
npm run db:migrate
npm run db:seed
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Available Scripts

### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
```

### Database
```bash
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database with medical knowledge
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset database
```

### Testing
```bash
npm run test              # Run tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run test:ui           # Open Vitest UI
```

### Code Quality
```bash
npm run lint              # Lint code
npm run lint:fix          # Lint and auto-fix issues
npm run format            # Format code
npm run format:check      # Check code formatting
npm run type-check        # TypeScript type checking
npm run validate          # Run all checks (type + lint + format + test)
```

### Docker
```bash
npm run docker:build      # Build Docker image
npm run docker:up         # Start all containers
npm run docker:down       # Stop all containers
```

## Testing

```bash
npm run test:coverage
```

## Deployment

### Local Development with Docker

```bash
docker-compose up
```

This starts:
- **app**: Backend API (port 3000)
- **postgres**: Database with pgvector (port 5432)

API available at: `http://localhost:3000`
Swagger UI: `http://localhost:3000/docs`

### Google Cloud Platform Deployment

#### Prerequisites

1. Install Google Cloud SDK:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

2. Create a GCP project:
```bash
gcloud projects create samu-ai-triage --name="SAMU AI Triage"
gcloud config set project samu-ai-triage
```

3. Enable required APIs:
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

#### Setup Cloud SQL (PostgreSQL)

```bash
# Create PostgreSQL instance
gcloud sql instances create samu-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1

# Create database
gcloud sql databases create samu_triage --instance=samu-db

# Create user
gcloud sql users create samuai \
  --instance=samu-db \
  --password=YOUR_SECURE_PASSWORD
```

#### Setup Secrets

```bash
# Store secrets in Google Secret Manager
echo -n "postgresql://samuai:PASSWORD@/cloudsql/PROJECT_ID:europe-west1:samu-db/samu_triage" | \
  gcloud secrets create samu-database-url --data-file=-

echo -n "YOUR_ANTHROPIC_API_KEY" | \
  gcloud secrets create samu-anthropic-key --data-file=-

openssl rand -base64 32 | gcloud secrets create samu-jwt-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create samu-encryption-key --data-file=-
```

#### Deploy with Cloud Build

```bash
# Submit build (automatically deploys to Cloud Run)
gcloud builds submit --config=cloudbuild.yaml

# Or connect to GitHub repository for automatic deployments
gcloud builds triggers create github \
  --repo-name=Hackaton_google \
  --repo-owner=MirageAiEIP \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

#### Manual Deploy to Cloud Run

```bash
# Build and push image
docker build -t gcr.io/PROJECT_ID/samu-ai-triage .
docker push gcr.io/PROJECT_ID/samu-ai-triage

# Deploy to Cloud Run
gcloud run deploy samu-ai-triage \
  --image=gcr.io/PROJECT_ID/samu-ai-triage \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production,LOG_LEVEL=info \
  --set-secrets=DATABASE_URL=samu-database-url:latest,ANTHROPIC_API_KEY=samu-anthropic-key:latest \
  --memory=512Mi \
  --cpu=1 \
  --max-instances=10
```

#### View Deployment

```bash
# Get service URL
gcloud run services describe samu-ai-triage --region=europe-west1 --format='value(status.url)'

# View logs
gcloud run logs read samu-ai-triage --region=europe-west1 --limit=50
```

## Environment Variables

Required environment variables (see `.env.example`):

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://user:password@localhost:5432/samu_triage"
ANTHROPIC_API_KEY=your_anthropic_api_key
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

## API Endpoints

### Health Checks
```
GET /health        # Comprehensive health check
GET /health/live   # Liveness probe (Kubernetes)
GET /health/ready  # Readiness probe (Kubernetes)
```

### Triage API (Coming Soon)
```
POST /api/v1/calls           # Initiate new triage call
GET  /api/v1/calls/:id       # Retrieve call details
POST /api/v1/calls/:id/msg   # Send message to AI agent
GET  /api/v1/reports/:id     # Get triage report
```

## CI/CD Pipeline

### GitHub Actions

Executes on every push and pull request:

1. Lint (ESLint + Prettier)
2. Type Check (TypeScript strict mode)
3. Test (Vitest with PostgreSQL service container)
4. Build (Production build verification)
5. Security (npm audit)

### Google Cloud Build

Automated deployment pipeline (`cloudbuild.yaml`):

1. Install dependencies
2. Run linter
3. Run type check
4. Run tests
5. Build application
6. Build Docker image
7. Push to Google Container Registry
8. Deploy to Cloud Run

Triggered automatically on push to `main` branch when connected to GitHub.

## Documentation

- [docs/DATABASE.md](./docs/DATABASE.md) - Database schema documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Mastra AI - TypeScript AI framework
- Anthropic - Claude LLM
- Fastify - Web framework
- Prisma - Database ORM
- Google Cloud - Cloud infrastructure

## Contact

SAMU AI Team - Google Hackathon 2025

Project Repository: [https://github.com/MirageAiEIP/Hackaton_google](https://github.com/MirageAiEIP/Hackaton_google)
