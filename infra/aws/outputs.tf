output "s3_bucket_name" {
  description = "Name of the provisioned private S3 bucket"
  value       = aws_s3_bucket.storage.id
}

output "s3_bucket_arn" {
  description = "ARN of the private S3 bucket"
  value       = aws_s3_bucket.storage.arn
}

output "eventbridge_bus_name" {
  description = "Name of the custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.ecopulse.name
}

output "eventbridge_bus_arn" {
  description = "ARN of the custom EventBridge bus"
  value       = aws_cloudwatch_event_bus.ecopulse.arn
}

output "report_processor_lambda_arn" {
  description = "ARN of the reportProcessor Lambda"
  value       = aws_lambda_function.report_processor.arn
}

output "ai_processor_lambda_arn" {
  description = "ARN of the aiAnalysisProcessor Lambda"
  value       = aws_lambda_function.ai_analysis_processor.arn
}

output "embedding_processor_lambda_arn" {
  description = "ARN of the embeddingProcessor Lambda"
  value       = aws_lambda_function.embedding_processor.arn
}

output "hotspot_processor_lambda_arn" {
  description = "ARN of the hotspotProcessor Lambda"
  value       = aws_lambda_function.hotspot_processor.arn
}
