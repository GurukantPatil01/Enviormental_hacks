# Dummy archive for initial plan/validation without requiring built zip
data "archive_file" "dummy_lambda" {
  type        = "zip"
  output_path = "${path.module}/dummy_lambda.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'placeholder' });"
    filename = "index.js"
  }
}

# 1. reportProcessor Lambda
resource "aws_lambda_function" "report_processor" {
  function_name = "ecopulse-report-processor-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "dist/handlers/lambda.reportProcessorHandler"
  runtime       = "nodejs20.x"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout
  filename      = data.archive_file.dummy_lambda.output_path

  environment {
    variables = {
      APP_ENV        = var.environment
      S3_BUCKET_NAME = aws_s3_bucket.storage.id
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.ecopulse.name
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "allow_eb_report" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.report_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.report_created_rule.arn
}

# 2. aiAnalysisProcessor Lambda
resource "aws_lambda_function" "ai_analysis_processor" {
  function_name = "ecopulse-ai-processor-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "dist/handlers/lambda.aiAnalysisProcessorHandler"
  runtime       = "nodejs20.x"
  memory_size   = 1024 # Extra memory for vision payload handling
  timeout       = 90
  filename      = data.archive_file.dummy_lambda.output_path

  environment {
    variables = {
      APP_ENV        = var.environment
      S3_BUCKET_NAME = aws_s3_bucket.storage.id
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.ecopulse.name
      AI_PROVIDER    = "bedrock"
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "allow_eb_ai" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_analysis_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ai_analysis_rule.arn
}

# 3. embeddingProcessor Lambda
resource "aws_lambda_function" "embedding_processor" {
  function_name = "ecopulse-embedding-processor-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "dist/handlers/lambda.embeddingProcessorHandler"
  runtime       = "nodejs20.x"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout
  filename      = data.archive_file.dummy_lambda.output_path

  environment {
    variables = {
      APP_ENV        = var.environment
      S3_BUCKET_NAME = aws_s3_bucket.storage.id
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.ecopulse.name
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "allow_eb_embedding" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.embedding_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.embedding_rule.arn
}

# 4. hotspotProcessor Lambda
resource "aws_lambda_function" "hotspot_processor" {
  function_name = "ecopulse-hotspot-processor-${var.environment}"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "dist/handlers/lambda.hotspotProcessorHandler"
  runtime       = "nodejs20.x"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout
  filename      = data.archive_file.dummy_lambda.output_path

  environment {
    variables = {
      APP_ENV        = var.environment
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.ecopulse.name
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "allow_eb_hotspot" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hotspot_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.hotspot_rule.arn
}
