# Execution Role for Lambda Asynchronous Processors
resource "aws_iam_role" "lambda_exec_role" {
  name = "ecopulse-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logs policy
resource "aws_iam_role_policy_attachment" "lambda_basic_exec" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for S3 access, EventBridge publishing, and Bedrock invocation
resource "aws_iam_policy" "lambda_ecopulse_policy" {
  name        = "ecopulse-lambda-policy-${var.environment}"
  description = "Permissions for EcoPulse Lambda processors: S3, EventBridge, CloudWatch Metrics, Bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 Bucket Access (Least privilege on ecoPulse storage bucket)
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.storage.arn}/*"
      },
      # EventBridge Publish
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.ecopulse.arn
      },
      # CloudWatch Custom Metrics
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      # Bedrock Multimodal Vision Invocation (Least Privilege)
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/*",
          "arn:aws:bedrock:${var.aws_region}:*:inference-profile/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ecopulse_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_ecopulse_policy.arn
}

# Standalone Least-Privilege IAM Policy for ecopulse-s3-user / backend credentials
resource "aws_iam_policy" "backend_bedrock_vision_policy" {
  name        = "ecopulse-backend-bedrock-vision-${var.environment}"
  description = "Least privilege Bedrock vision inference policy for EcoPulse backend workers and ecopulse-s3-user"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBedrockMultimodalVisionInference"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/*",
          "arn:aws:bedrock:${var.aws_region}:*:inference-profile/*"
        ]
      }
    ]
  })
}
