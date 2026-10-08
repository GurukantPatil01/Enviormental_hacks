# S3 Private Bucket for Environmental Evidence & Reports
resource "aws_s3_bucket" "storage" {
  bucket = "${var.bucket_prefix}-${var.environment}"
}

# Block all public access - strictly private bucket accessed only via presigned URLs
resource "aws_s3_bucket_public_access_block" "storage_block_public" {
  bucket = aws_s3_bucket.storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption using AWS managed keys (no extra KMS cost)
resource "aws_s3_bucket_server_side_encryption_configuration" "storage_encryption" {
  bucket = aws_s3_bucket.storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rules to enforce cost controls (prune old artifacts and temporary uploads)
resource "aws_s3_bucket_lifecycle_configuration" "storage_lifecycle" {
  bucket = aws_s3_bucket.storage.id

  rule {
    id     = "expire-temporary-artifacts"
    status = "Enabled"

    filter {
      prefix = "artifacts/temp/"
    }

    expiration {
      days = 7
    }
  }

  rule {
    id     = "transition-old-evidence-glacier"
    status = var.environment == "prod" ? "Enabled" : "Disabled"

    filter {
      prefix = "reports/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# CORS configuration for authorized web presigned upload operations
resource "aws_s3_bucket_cors_configuration" "storage_cors" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["*"] # Tighten in production to exact domain
    max_age_seconds = 3000
  }
}
