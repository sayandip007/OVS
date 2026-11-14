# ==============================================================================
# OVS Production Infrastructure Architecture — Terraform Reference Template
# ==============================================================================
# Demonstrates containerized modular monolith topology with private database,
# managed reverse proxy / load balancer, and multi-AZ isolation.

terraform {
  required_version = ">= 1.5.0"
}

# Local architectural tags and configuration metadata
locals {
  name_prefix = "ovs-${var.environment}"
  common_tags = {
    Project     = "OnlineVotingSystem"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Application = "OVS-Simulation"
  }
}

# Simulated VPC & Network Topology
resource "null_resource" "network_topology" {
  triggers = {
    vpc_cidr            = "10.0.0.0/16"
    public_subnets      = "10.0.1.0/24,10.0.2.0/24"
    app_private_subnets = "10.0.11.0/24,10.0.12.0/24"
    db_isolated_subnets = "10.0.21.0/24,10.0.22.0/24"
  }
}

# Simulated PostgreSQL 16 Private Database Instance
resource "null_resource" "managed_postgres" {
  triggers = {
    engine                 = "postgres"
    engine_version         = "16.4"
    instance_class         = var.db_instance_class
    allocated_storage      = var.db_allocated_storage_gb
    db_name                = var.db_name
    backup_retention_days  = 14
    deletion_protection    = true
    multi_az               = var.environment == "production" ? true : false
    publicly_accessible    = false
  }
}

# Simulated Container Service (ECS / Cloud Run / Kubernetes Deployment)
resource "null_resource" "backend_service" {
  triggers = {
    service_name    = "${local.name_prefix}-backend"
    desired_count   = var.app_replica_count
    cpu             = var.app_container_cpu
    memory          = var.app_container_memory
    container_port  = 5000
    healthcheck_url = "/api/v1/health"
  }
}

# Simulated Web Application Gateway / Reverse Proxy (ALB / Nginx Ingress)
resource "null_resource" "edge_load_balancer" {
  triggers = {
    name       = "${local.name_prefix}-alb"
    scheme     = "internet-facing"
    ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  }
}
