#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
ACTION="${2:-plan}"
PROJECT_ID="samu-ai-474822"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Invalid environment. Use: staging or production"
  exit 1
fi

if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
  echo "Invalid action. Use: plan, apply, or destroy"
  exit 1
fi

echo "Terraform ${ACTION} for ${ENVIRONMENT}..."

cd "terraform/environments/${ENVIRONMENT}"

if [ ! -d ".terraform" ]; then
  echo "Terraform not initialized. Running init..."
  terraform init
fi

case "$ACTION" in
  plan)
    terraform plan -out="tfplan-${ENVIRONMENT}.out"
    echo "Plan saved to tfplan-${ENVIRONMENT}.out"
    echo "To apply: terraform apply tfplan-${ENVIRONMENT}.out"
    ;;

  apply)
    if [ -f "tfplan-${ENVIRONMENT}.out" ]; then
      terraform apply "tfplan-${ENVIRONMENT}.out"
      rm -f "tfplan-${ENVIRONMENT}.out"
    else
      terraform plan -out="tfplan-${ENVIRONMENT}.out"
      read -p "Apply this plan? (yes/no): " confirm
      if [ "$confirm" = "yes" ]; then
        terraform apply "tfplan-${ENVIRONMENT}.out"
        rm -f "tfplan-${ENVIRONMENT}.out"
      else
        echo "Apply cancelled"
        exit 1
      fi
    fi

    echo "Infrastructure deployed"
    terraform output
    ;;

  destroy)
    if [ "$ENVIRONMENT" = "production" ]; then
      echo "WARNING: Destroying PRODUCTION infrastructure"
      read -p "Type 'destroy-production' to confirm: " confirm
      if [ "$confirm" != "destroy-production" ]; then
        echo "Destroy cancelled"
        exit 1
      fi
    fi
    terraform destroy
    ;;
esac
