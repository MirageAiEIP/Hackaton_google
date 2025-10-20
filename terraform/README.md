# SAMU AI Terraform Infrastructure

Infrastructure as Code for SAMU AI Triage System using Terraform.

## Structure

```
terraform/
├── main.tf                    # Root module
├── modules/                   # Reusable modules
│   ├── networking/            # VPC, Subnets, VPC Connector
│   ├── database/              # Cloud SQL PostgreSQL
│   ├── redis/                 # Cloud Memorystore Redis
│   ├── secrets/               # Secret Manager
│   ├── cloud_run/             # Cloud Run service
│   └── monitoring/            # Monitoring & Alerting
└── environments/              # Environment-specific configs
    ├── staging/
    │   ├── main.tf
    │   └── terraform.tfvars
    └── production/
        ├── main.tf
        └── terraform.tfvars
```

## Quick Start

### 1. Initialize

```bash
# From project root
./scripts/terraform-init.sh staging
./scripts/terraform-init.sh production
```

### 2. Deploy

```bash
# Staging
./scripts/terraform-deploy.sh staging plan
./scripts/terraform-deploy.sh staging apply

# Production
./scripts/terraform-deploy.sh production plan
./scripts/terraform-deploy.sh production apply
```

### 3. Get Outputs

```bash
cd terraform/environments/staging
terraform output

# Get specific output
terraform output cloud_run_url
terraform output database_connection_name
```

## Modules

### Networking

Creates:
- VPC network
- Private subnet for VPC Connector
- Subnet for Cloud SQL private IP
- Serverless VPC Connector
- Private Service Connection
- Firewall rules

**Outputs:**
- `vpc_network_id`
- `vpc_connector_id`

### Database (Cloud SQL)

Creates:
- PostgreSQL 16 instance
- Database `samu_triage`
- User `samu_app` with random password
- Automated backups
- Private IP configuration

**Staging:**
- Tier: db-custom-2-7680 (2 vCPU, 7.5 GB)
- Availability: ZONAL
- Disk: 50 GB SSD

**Production:**
- Tier: db-custom-4-16384 (4 vCPU, 16 GB)
- Availability: REGIONAL (HA)
- Disk: 100 GB SSD
- Point-in-time recovery enabled

**Outputs:**
- `connection_name`
- `private_ip_address`
- `database_url` (sensitive)

### Redis (Cloud Memorystore)

Creates:
- Redis 7.0 instance
- HA configuration (production)

**Staging:**
- Memory: 2 GB
- Tier: BASIC

**Production:**
- Memory: 5 GB
- Tier: STANDARD_HA
- Read replicas enabled

**Outputs:**
- `redis_host`
- `redis_port`
- `redis_url`

### Secrets

Creates Secret Manager secrets with environment prefix:
- `{env}-elevenlabs-api-key`
- `{env}-elevenlabs-agent-id`
- `{env}-google-api-key`
- `{env}-twilio-account-sid`
- `{env}-twilio-auth-token`
- `{env}-twilio-phone-number`

**Note:** Secret values must be uploaded separately:
```bash
./scripts/upload-secrets-by-env.sh staging
```

### Cloud Run

Creates:
- Cloud Run service with VPC connector
- Service account with required permissions
- Environment variables from infrastructure outputs
- Secrets mounting from Secret Manager
- Health probes

**Scaling:**
- Staging: 0-5 instances
- Production: 1-20 instances

### Monitoring

Creates:
- Email notification channel
- Alert policies:
  - High error rate (>5%)
  - High latency (P95 >2s)
  - High memory (>80%)
  - Cloud SQL CPU (>80%)
  - Redis memory (>90%)
- Custom dashboard with metrics

## State Management

Terraform state is stored in Google Cloud Storage:

**Bucket:** `gs://samu-ai-terraform-state/`

**State files:**
- `staging/default.tfstate`
- `production/default.tfstate`

**Locking:** Enabled (prevents concurrent modifications)

## Variables

See `terraform.tfvars` in each environment directory.

**Common variables:**
- `project_id` - GCP Project ID
- `region` - GCP Region (default: europe-west1)
- `environment` - staging or production

## Outputs

After `terraform apply`, outputs are displayed:

```
cloud_run_url = "https://samu-ai-triage-staging-xxxxx.run.app"
database_connection_name = "samu-ai-474822:europe-west1:samu-ai-db-staging"
redis_host = "10.x.x.x"
vpc_connector_id = "projects/samu-ai-474822/locations/europe-west1/connectors/samu-ai-vpc-conn-staging"
```

## Destroy Infrastructure

**WARNING:** This will delete all resources including databases!

```bash
# Staging
./scripts/terraform-deploy.sh staging destroy

# Production (requires confirmation)
./scripts/terraform-deploy.sh production destroy
```

## Troubleshooting

### Terraform init fails

```bash
# Ensure GCS bucket exists
gsutil mb -p samu-ai-474822 -l europe-west1 gs://samu-ai-terraform-state

# Enable versioning
gsutil versioning set on gs://samu-ai-terraform-state
```

### API not enabled error

```bash
# Enable all required APIs
gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  --project=samu-ai-474822
```

### VPC Peering failed

```bash
# Wait for Service Networking API to be ready
sleep 60

# Retry terraform apply
terraform apply
```

### Cloud SQL creation timeout

Cloud SQL instances take 10-15 minutes to provision. If terraform times out:

```bash
# Wait for instance to finish provisioning in GCP Console
# Then run terraform refresh
terraform refresh

# Continue with apply
terraform apply
```

## Best Practices

1. **Always run `terraform plan` first**
2. **Review changes before applying**
3. **Use separate environments (staging/prod)**
4. **Never commit `.tfstate` files to git**
5. **Use Terraform workspaces for isolation**
6. **Tag resources for cost tracking**
7. **Enable deletion protection for production DB**

## Cost Estimates

**Staging:**
- Cloud SQL: ~$80/month
- Redis: ~$50/month
- VPC Connector: ~$10/month
- Cloud Run: Pay-per-use (~$10-20/month)
- **Total: ~$150-160/month**

**Production:**
- Cloud SQL (HA): ~$400/month
- Redis (HA): ~$200/month
- VPC Connector: ~$20/month
- Cloud Run: ~$50-100/month
- **Total: ~$670-720/month**

## Support

For issues with Terraform infrastructure:
1. Check [DEPLOYMENT.md](../DEPLOYMENT.md)
2. Review [Google Cloud documentation](https://cloud.google.com/docs)
3. Open GitHub issue with `infrastructure` label
