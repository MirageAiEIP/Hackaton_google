#!/bin/bash
set -e

ENVIRONMENT="${1}"
BACKUP_ID="${2}"
PROJECT_ID="samu-ai-474822"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

if [ -z "$BACKUP_ID" ]; then
  echo "Backup ID required"
  echo ""
  echo "Available backups:"
  gcloud sql backups list \
    --instance="samu-ai-db-${ENVIRONMENT}" \
    --project="${PROJECT_ID}"
  exit 1
fi

INSTANCE_NAME="samu-ai-db-${ENVIRONMENT}"

echo "WARNING: Restoring database to backup ${BACKUP_ID}"
echo "Instance: ${INSTANCE_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo ""
read -p "Type 'restore' to confirm: " confirm

if [ "$confirm" != "restore" ]; then
  echo "Restore cancelled"
  exit 1
fi

echo "Restoring backup..."

gcloud sql backups restore "${BACKUP_ID}" \
  --backup-instance="${INSTANCE_NAME}" \
  --project="${PROJECT_ID}"

echo "Database restored successfully"
echo ""
echo "Restart Cloud Run service:"
echo "gcloud run services update samu-ai-triage-${ENVIRONMENT} --region=europe-west1 --project=${PROJECT_ID}"
