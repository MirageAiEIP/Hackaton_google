#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
PROJECT_ID="samu-ai-474822"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

echo "Uploading secrets for ${ENVIRONMENT}..."

ENV_FILE=".env.${ENVIRONMENT}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "${ENV_FILE} not found"
  echo ""
  echo "Required variables:"
  echo "  ELEVENLABS_API_KEY"
  echo "  ELEVENLABS_AGENT_ID"
  echo "  GOOGLE_API_KEY"
  echo "  TWILIO_ACCOUNT_SID"
  echo "  TWILIO_AUTH_TOKEN"
  echo "  TWILIO_PHONE_NUMBER"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

gcloud services enable secretmanager.googleapis.com --project="${PROJECT_ID}"

upload_secret() {
  local SECRET_NAME="$1"
  local SECRET_VALUE="$2"
  local FULL_NAME="${ENVIRONMENT}-${SECRET_NAME}"

  if [ -z "${SECRET_VALUE}" ]; then
    echo "Skipping ${SECRET_NAME} (empty value)"
    return
  fi

  echo "Uploading ${FULL_NAME}..."

  if gcloud secrets describe "${FULL_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    echo -n "${SECRET_VALUE}" | \
      gcloud secrets versions add "${FULL_NAME}" \
      --data-file=- \
      --project="${PROJECT_ID}"
  else
    echo -n "${SECRET_VALUE}" | \
      gcloud secrets create "${FULL_NAME}" \
      --data-file=- \
      --replication-policy="automatic" \
      --project="${PROJECT_ID}"
  fi
}

upload_secret "elevenlabs-api-key" "${ELEVENLABS_API_KEY}"
upload_secret "elevenlabs-agent-id" "${ELEVENLABS_AGENT_ID}"
upload_secret "google-api-key" "${GOOGLE_API_KEY}"
upload_secret "twilio-account-sid" "${TWILIO_ACCOUNT_SID}"
upload_secret "twilio-auth-token" "${TWILIO_AUTH_TOKEN}"
upload_secret "twilio-phone-number" "${TWILIO_PHONE_NUMBER}"

if [ -n "${DATABASE_URL}" ]; then
  upload_secret "database-url" "${DATABASE_URL}"
fi

echo ""
echo "All secrets uploaded for ${ENVIRONMENT}"
echo ""
gcloud secrets list \
  --project="${PROJECT_ID}" \
  --filter="name:${ENVIRONMENT}-*" \
  --format="table(name,createTime)"
