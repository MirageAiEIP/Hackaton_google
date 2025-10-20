#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
PROJECT_ID="samu-ai-474822"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

echo "Initializing Terraform for ${ENVIRONMENT}..."

cd "terraform/environments/${ENVIRONMENT}"

gsutil mb -p "${PROJECT_ID}" -l europe-west1 "gs://samu-ai-terraform-state" 2>/dev/null || echo "Bucket already exists"
gsutil versioning set on "gs://samu-ai-terraform-state"

gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="${PROJECT_ID}"

terraform init

echo "Terraform initialized for ${ENVIRONMENT}"
echo "Next: terraform plan && terraform apply"
