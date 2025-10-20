#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
PROJECT_ID="samu-ai-474822"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

INSTANCE_NAME="samu-ai-db-${ENVIRONMENT}"

echo "Creating backup for ${ENVIRONMENT}..."
echo "Instance: ${INSTANCE_NAME}"

gcloud sql backups create \
  --instance="${INSTANCE_NAME}" \
  --description="Manual backup created on ${TIMESTAMP}" \
  --project="${PROJECT_ID}"

echo "Backup created successfully"
echo ""
echo "Recent backups:"
gcloud sql backups list \
  --instance="${INSTANCE_NAME}" \
  --project="${PROJECT_ID}" \
  --limit=5
