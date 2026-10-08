variable "aws_region" {
  description = "AWS deployment region (Mumbai by default for India latency & compliance)"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment stage (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "bucket_prefix" {
  description = "Prefix for S3 storage bucket"
  type        = string
  default     = "ecopulse-storage"
}

variable "event_bus_name" {
  description = "Custom EventBridge event bus name"
  type        = string
  default     = "ecopulse-events"
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days for cost control"
  type        = number
  default     = 7
}

variable "lambda_memory_size" {
  description = "Default memory allocation for asynchronous Lambda processors"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Default timeout in seconds for processor Lambdas"
  type        = number
  default     = 60
}
