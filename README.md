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

- **Backend**: TypeScript + Hono
- **AI Framework**: Mastra AI
- **Database**: PostgreSQL 16 + pgvector
- **ORM**: Prisma
- **LLM**: Claude 3.5 Sonnet (Anthropic)
- **Testing**: Vitest
- **CI/CD**: GitHub Actions
- **Containerization**: Docker + docker-compose

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

The project enforces minimum 80% code coverage across all metrics.

### Coverage Thresholds
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

```bash
npm run test:coverage
```

## Docker Deployment

### Development Environment

```bash
docker-compose up
```

This starts three services:
- **app**: Backend API (port 3000)
- **postgres**: Database with pgvector (port 5432)
- **redis**: Cache and rate limiting (port 6379)

### Production Deployment

```bash
docker build -t samu-ai-triage .

docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/db" \
  -e ANTHROPIC_API_KEY="your_key" \
  samu-ai-triage
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

GitHub Actions workflow executes on every push and pull request:

1. Lint (ESLint + Prettier)
2. Type Check (TypeScript strict mode)
3. Test (Vitest with PostgreSQL service container)
4. Build (Production build verification)
5. Security (npm audit + Snyk scanning)

All checks must pass before merging.

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
- Hono - Web framework
- Prisma - Database ORM

## Contact

SAMU AI Team - Google Hackathon 2025

Project Repository: [https://github.com/MirageAiEIP/Hackaton_google](https://github.com/MirageAiEIP/Hackaton_google)
