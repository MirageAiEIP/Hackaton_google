#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
PROJECT_ID="gaia-477710"
REGION="europe-west1"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

echo "Running database migrations for ${ENVIRONMENT}..."

INSTANCE_NAME=$(gcloud sql instances list \
  --project="${PROJECT_ID}" \
  --filter="name:samu-ai-db-${ENVIRONMENT}" \
  --format="value(connectionName)" \
  --limit=1)

if [ -z "$INSTANCE_NAME" ]; then
  echo "Cloud SQL instance not found for ${ENVIRONMENT}"
  exit 1
fi

echo "Instance: ${INSTANCE_NAME}"

DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="${ENVIRONMENT}-database-password" \
  --project="${PROJECT_ID}")

DB_HOST=$(gcloud sql instances describe "samu-ai-db-${ENVIRONMENT}" \
  --project="${PROJECT_ID}" \
  --format="value(ipAddresses[0].ipAddress)")

export DATABASE_URL="postgresql://samu_app:${DB_PASSWORD}@${DB_HOST}:5432/samu_triage"

npm run db:generate
npm run db:migrate:prod

echo "Migrations completed successfully"
