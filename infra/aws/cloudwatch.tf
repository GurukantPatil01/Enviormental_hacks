# Explicit CloudWatch Log Groups with cost-controlled retention periods
resource "aws_cloudwatch_log_group" "report_processor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.report_processor.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "ai_processor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.ai_analysis_processor.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "embedding_processor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.embedding_processor.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "hotspot_processor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.hotspot_processor.function_name}"
  retention_in_days = var.log_retention_days
}

# CloudWatch Alarm for Errors in Pipeline Processors
resource "aws_cloudwatch_metric_alarm" "pipeline_error_alarm" {
  alarm_name          = "ecopulse-pipeline-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggers when asynchronous pipeline Lambdas encounter 5+ errors in 5 minutes"

  dimensions = {
    FunctionName = aws_lambda_function.ai_analysis_processor.function_name
  }
}
