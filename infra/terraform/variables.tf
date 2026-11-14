# ==============================================================================
# OVS Terraform Reference Configuration — Input Variables
# ==============================================================================

variable "environment" {
  type        = string
  description = "Target deployment environment (staging, production)"
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "region" {
  type        = string
  description = "Target cloud deployment region (e.g., ap-south-1)"
  default     = "ap-south-1"
}

variable "db_instance_class" {
  type        = string
  description = "Managed PostgreSQL compute size"
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type        = number
  description = "Allocated disk storage for database in GB"
  default     = 50
}

variable "db_name" {
  type        = string
  description = "Application database name"
  default     = "ovs_production"
}

variable "db_username" {
  type        = string
  description = "Primary database master username"
  default     = "ovs_admin"
}

variable "app_container_cpu" {
  type        = number
  description = "Backend container CPU units (1024 = 1 vCPU)"
  default     = 1024
}

variable "app_container_memory" {
  type        = number
  description = "Backend container Memory limit (in MiB)"
  default     = 2048
}

variable "app_replica_count" {
  type        = number
  description = "Desired number of backend API container replicas"
  default     = 2
}
