/**
 * EcoPulse AWS Infrastructure (Terraform Skeleton for Future Deployment)
 * Target Services: ECS Fargate, RDS Aurora PostgreSQL (PostGIS), S3, SQS, Cognito, Bedrock
 */

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "EcoPulse"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type    = string
  default = "production"
}

# 1. VPC & Networking
resource "aws_vpc" "ecopulse_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "ecopulse-vpc-${var.environment}"
  }
}

# 2. S3 Bucket for Media, Drone Scans & Evidentiary Assets
resource "aws_s3_bucket" "ecopulse_evidence" {
  bucket = "ecopulse-evidence-${var.environment}"
}

# 3. SQS Queue for Domain Events & Asynchronous Agent Workflows
resource "aws_sqs_queue" "domain_events" {
  name                      = "ecopulse-domain-events-${var.environment}"
  message_retention_seconds = 86400
}

# 4. Amazon Cognito User Pool (For Production Authentication)
resource "aws_cognito_user_pool" "ecopulse_users" {
  name = "ecopulse-user-pool-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }
}
