# SAMU AI Triage - Makefile
# Simplified commands for deployment and operations

.PHONY: help

help:
	@echo "SAMU AI Triage - Deployment Commands"
	@echo ""
	@echo "Usage: make [command]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'

# ============================================================================
# Infrastructure (Terraform)
# ============================================================================

tf-init-staging: ## Initialize Terraform for staging
	./scripts/terraform-init.sh staging

tf-init-prod: ## Initialize Terraform for production
	./scripts/terraform-init.sh production

tf-plan-staging: ## Plan staging infrastructure
	./scripts/terraform-deploy.sh staging plan

tf-plan-prod: ## Plan production infrastructure
	./scripts/terraform-deploy.sh production plan

tf-apply-staging: ## Deploy staging infrastructure
	./scripts/terraform-deploy.sh staging apply

tf-apply-prod: ## Deploy production infrastructure
	./scripts/terraform-deploy.sh production apply

tf-destroy-staging: ## Destroy staging infrastructure (DANGEROUS)
	./scripts/terraform-deploy.sh staging destroy

tf-destroy-prod: ## Destroy production infrastructure (DANGEROUS)
	./scripts/terraform-deploy.sh production destroy

# ============================================================================
# Secrets Management
# ============================================================================

secrets-staging: ## Upload secrets to staging
	./scripts/upload-secrets-by-env.sh staging

secrets-prod: ## Upload secrets to production
	./scripts/upload-secrets-by-env.sh production

secrets-list-staging: ## List staging secrets
	@gcloud secrets list --filter="name:staging-*" --project=samu-ai-474822

secrets-list-prod: ## List production secrets
	@gcloud secrets list --filter="name:production-*" --project=samu-ai-474822

# ============================================================================
# Database Operations
# ============================================================================

db-migrate-staging: ## Run database migrations on staging
	./scripts/db-migrate.sh staging

db-migrate-prod: ## Run database migrations on production
	./scripts/db-migrate.sh production

db-backup-staging: ## Create staging database backup
	./scripts/db-backup.sh staging

db-backup-prod: ## Create production database backup
	./scripts/db-backup.sh production

db-restore-staging: ## Restore staging database (requires BACKUP_ID)
	@read -p "Enter backup ID: " BACKUP_ID; \
	./scripts/db-restore.sh staging $$BACKUP_ID

db-restore-prod: ## Restore production database (requires BACKUP_ID)
	@read -p "Enter backup ID: " BACKUP_ID; \
	./scripts/db-restore.sh production $$BACKUP_ID

db-console-staging: ## Open staging database console
	@gcloud sql connect samu-ai-db-staging --user=samu_app --project=samu-ai-474822

db-console-prod: ## Open production database console
	@gcloud sql connect samu-ai-db-production --user=samu_app --project=samu-ai-474822

# ============================================================================
# Monitoring & Logs
# ============================================================================

logs-staging: ## Tail staging logs
	@gcloud run logs tail samu-ai-triage-staging --region=europe-west1 --project=samu-ai-474822

logs-prod: ## Tail production logs
	@gcloud run logs tail samu-ai-triage-production --region=europe-west1 --project=samu-ai-474822

logs-staging-errors: ## Tail staging error logs only
	@gcloud run logs tail samu-ai-triage-staging --region=europe-west1 --project=samu-ai-474822 --filter="severity>=ERROR"

logs-prod-errors: ## Tail production error logs only
	@gcloud run logs tail samu-ai-triage-production --region=europe-west1 --project=samu-ai-474822 --filter="severity>=ERROR"

dashboard-staging: ## Open staging monitoring dashboard
	@echo "Opening: https://console.cloud.google.com/run/detail/europe-west1/samu-ai-triage-staging/metrics?project=samu-ai-474822"

dashboard-prod: ## Open production monitoring dashboard
	@echo "Opening: https://console.cloud.google.com/run/detail/europe-west1/samu-ai-triage-production/metrics?project=samu-ai-474822"

# ============================================================================
# Service Management
# ============================================================================

service-info-staging: ## Show staging service info
	@gcloud run services describe samu-ai-triage-staging --region=europe-west1 --project=samu-ai-474822

service-info-prod: ## Show production service info
	@gcloud run services describe samu-ai-triage-production --region=europe-west1 --project=samu-ai-474822

service-url-staging: ## Get staging service URL
	@gcloud run services describe samu-ai-triage-staging --region=europe-west1 --format='value(status.url)' --project=samu-ai-474822

service-url-prod: ## Get production service URL
	@gcloud run services describe samu-ai-triage-production --region=europe-west1 --format='value(status.url)' --project=samu-ai-474822

health-staging: ## Check staging health
	@curl -f $$(gcloud run services describe samu-ai-triage-staging --region=europe-west1 --format='value(status.url)' --project=samu-ai-474822)/health && echo "Healthy" || echo "Unhealthy"

health-prod: ## Check production health
	@curl -f $$(gcloud run services describe samu-ai-triage-production --region=europe-west1 --format='value(status.url)' --project=samu-ai-474822)/health && echo "Healthy" || echo "Unhealthy"

# ============================================================================
# Development
# ============================================================================

dev: ## Start local development server
	npm run dev

build: ## Build application
	npm run build

test: ## Run tests
	npm run test

validate: ## Run full validation (lint + type-check + tests)
	npm run validate

docker-build: ## Build Docker image locally
	docker build -t samu-ai-triage:local -f Dockerfile.production .

docker-run: ## Run Docker image locally
	docker run -p 3000:3000 --env-file .env samu-ai-triage:local

# ============================================================================
# Complete Deployment Workflows
# ============================================================================

deploy-staging-full: ## Full staging deployment (infra + secrets + app)
	@echo "Starting full staging deployment..."
	@echo "Step 1: Deploying infrastructure..."
	@$(MAKE) tf-apply-staging
	@echo "Step 2: Uploading secrets..."
	@$(MAKE) secrets-staging
	@echo "Step 3: Running migrations..."
	@$(MAKE) db-migrate-staging
	@echo "Staging deployment complete"

deploy-prod-full: ## Full production deployment (infra + secrets + app)
	@echo "Starting full production deployment..."
	@read -p "Deploy to PRODUCTION? (yes/no): " confirm; \
	if [ "$$confirm" != "yes" ]; then \
		echo "Deployment cancelled"; \
		exit 1; \
	fi
	@echo "Step 1: Deploying infrastructure..."
	@$(MAKE) tf-apply-prod
	@echo "Step 2: Uploading secrets..."
	@$(MAKE) secrets-prod
	@echo "Step 3: Running migrations..."
	@$(MAKE) db-migrate-prod
	@echo "Production deployment complete"

# ============================================================================
# Status & Diagnostics
# ============================================================================

status: ## Show status of all services (staging + prod)
	@echo "SAMU AI Triage - Infrastructure Status"
	@echo ""
	@echo "STAGING"
	@echo "  Cloud Run:"
	@gcloud run services describe samu-ai-triage-staging --region=europe-west1 --format="value(status.conditions[0].status)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"
	@echo "  Database:"
	@gcloud sql instances describe samu-ai-db-staging --format="value(state)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"
	@echo "  Redis:"
	@gcloud redis instances describe samu-ai-redis-staging --region=europe-west1 --format="value(state)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"
	@echo ""
	@echo "PRODUCTION"
	@echo "  Cloud Run:"
	@gcloud run services describe samu-ai-triage-production --region=europe-west1 --format="value(status.conditions[0].status)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"
	@echo "  Database:"
	@gcloud sql instances describe samu-ai-db-production --format="value(state)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"
	@echo "  Redis:"
	@gcloud redis instances describe samu-ai-redis-production --region=europe-west1 --format="value(state)" --project=samu-ai-474822 2>/dev/null && echo "    Running" || echo "    Not deployed"

clean: ## Clean build artifacts
	rm -rf dist/
	rm -rf node_modules/
	rm -rf coverage/
	rm -rf .turbo/
