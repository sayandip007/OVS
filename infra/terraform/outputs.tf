# ==============================================================================
# OVS Terraform Reference Configuration — Output Definitions
# ==============================================================================

output "environment" {
  description = "Target deployment environment"
  value       = var.environment
}

output "architecture_summary" {
  description = "Summary of configured multi-tier topology"
  value = {
    vpc_network_mode      = "Three-tier (public, private app, isolated db)"
    database_engine       = "PostgreSQL 16 Multi-AZ"
    database_port         = 5432
    backend_service_port  = 5000
    public_http_ingress   = 80
    public_https_ingress  = 443
    observability_endpoint = "/metrics"
  }
}
