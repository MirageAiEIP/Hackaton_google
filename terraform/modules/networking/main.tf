# Networking Module - VPC + Serverless VPC Connector

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "samu-ai-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet for VPC Connector
resource "google_compute_subnetwork" "vpc_connector_subnet" {
  name          = "samu-ai-vpc-connector-${var.environment}"
  ip_cidr_range = var.environment == "production" ? "10.8.0.0/28" : "10.9.0.0/28"
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  # Enable Private Google Access for Cloud SQL
  private_ip_google_access = true
}

# Subnet for Cloud SQL Private IP
resource "google_compute_subnetwork" "cloudsql_subnet" {
  name          = "samu-ai-cloudsql-${var.environment}"
  ip_cidr_range = var.environment == "production" ? "10.10.0.0/24" : "10.11.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  private_ip_google_access = true
}

# Global Address for Private Service Connection (Cloud SQL + Redis)
resource "google_compute_global_address" "private_ip_range" {
  name          = "samu-ai-private-ip-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

# Private VPC Connection (for Cloud SQL Private IP)
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# Serverless VPC Access Connector (pour Cloud Run → Cloud SQL + Redis)
resource "google_vpc_access_connector" "connector" {
  provider = google-beta

  name    = "samu-ai-vpc-conn-${var.environment}"
  region  = var.region
  project = var.project_id
  network = google_compute_network.vpc.name

  # Subnet mode (recommandé)
  subnet {
    name = google_compute_subnetwork.vpc_connector_subnet.name
  }

  # Throughput selon environnement
  machine_type = var.environment == "production" ? "e2-standard-4" : "e2-micro"
  min_instances = var.environment == "production" ? 2 : 1
  max_instances = var.environment == "production" ? 10 : 3

  depends_on = [google_compute_subnetwork.vpc_connector_subnet]
}

# Firewall rules
resource "google_compute_firewall" "allow_health_checks" {
  name    = "samu-ai-allow-health-checks-${var.environment}"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000"]
  }

  # Google Cloud health check IP ranges
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22"
  ]

  target_tags = ["samu-ai-${var.environment}"]
}

# Outputs
output "vpc_network_id" {
  value = google_compute_network.vpc.id
}

output "vpc_network_name" {
  value = google_compute_network.vpc.name
}

output "vpc_connector_id" {
  value = google_vpc_access_connector.connector.id
}

output "vpc_connector_name" {
  value = google_vpc_access_connector.connector.name
}

output "private_vpc_connection_id" {
  value = google_service_networking_connection.private_vpc_connection.id
}
