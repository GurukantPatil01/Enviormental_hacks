# Custom EventBridge Bus for EcoPulse Event-Driven Architecture
resource "aws_cloudwatch_event_bus" "ecopulse" {
  name = "${var.event_bus_name}-${var.environment}"
}

# Rule: Report Processing (Triggers reportProcessor Lambda)
resource "aws_cloudwatch_event_rule" "report_created_rule" {
  name           = "ecopulse-report-created-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  description    = "Routes REPORT_CREATED and EVIDENCE_UPLOADED events to reportProcessor Lambda"

  event_pattern = jsonencode({
    detail-type = ["REPORT_CREATED", "EVIDENCE_UPLOADED"]
    source      = [{ prefix = "ecopulse" }]
  })
}

resource "aws_cloudwatch_event_target" "report_target" {
  rule           = aws_cloudwatch_event_rule.report_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  target_id      = "ReportProcessorLambda"
  arn            = aws_lambda_function.report_processor.arn
}

# Rule: AI Analysis Request (Triggers aiAnalysisProcessor Lambda)
resource "aws_cloudwatch_event_rule" "ai_analysis_rule" {
  name           = "ecopulse-ai-analysis-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  description    = "Routes AI_ANALYSIS_REQUESTED events to aiAnalysisProcessor Lambda"

  event_pattern = jsonencode({
    detail-type = ["AI_ANALYSIS_REQUESTED"]
    source      = [{ prefix = "ecopulse" }]
  })
}

resource "aws_cloudwatch_event_target" "ai_analysis_target" {
  rule           = aws_cloudwatch_event_rule.ai_analysis_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  target_id      = "AIAnalysisProcessorLambda"
  arn            = aws_lambda_function.ai_analysis_processor.arn
}

# Rule: Embedding Request (Triggers embeddingProcessor Lambda)
resource "aws_cloudwatch_event_rule" "embedding_rule" {
  name           = "ecopulse-embedding-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  description    = "Routes EMBEDDING_REQUESTED events to embeddingProcessor Lambda"

  event_pattern = jsonencode({
    detail-type = ["EMBEDDING_REQUESTED"]
    source      = [{ prefix = "ecopulse" }]
  })
}

resource "aws_cloudwatch_event_target" "embedding_target" {
  rule           = aws_cloudwatch_event_rule.embedding_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  target_id      = "EmbeddingProcessorLambda"
  arn            = aws_lambda_function.embedding_processor.arn
}

# Rule: Hotspot Analysis Request (Triggers hotspotProcessor Lambda)
resource "aws_cloudwatch_event_rule" "hotspot_rule" {
  name           = "ecopulse-hotspot-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  description    = "Routes HOTSPOT_ANALYSIS_REQUESTED events to hotspotProcessor Lambda"

  event_pattern = jsonencode({
    detail-type = ["HOTSPOT_ANALYSIS_REQUESTED"]
    source      = [{ prefix = "ecopulse" }]
  })
}

resource "aws_cloudwatch_event_target" "hotspot_target" {
  rule           = aws_cloudwatch_event_rule.hotspot_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  target_id      = "HotspotProcessorLambda"
  arn            = aws_lambda_function.hotspot_processor.arn
}
