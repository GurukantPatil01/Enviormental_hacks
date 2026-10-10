# Amazon SQS Dead-Letter Queue (DLQ) for failed/poison evidence jobs
resource "aws_sqs_queue" "evidence_dlq" {
  name                      = "ecopulse-evidence-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days retention for inspection and recovery

  tags = {
    Environment = var.environment
    Service     = "ecopulse-evidence-dlq"
    ManagedBy   = "terraform"
  }
}

# Amazon SQS Primary Evidence Processing Queue
resource "aws_sqs_queue" "evidence_queue" {
  name                       = "ecopulse-evidence-queue-${var.environment}"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 days retention
  receive_wait_time_seconds  = 20     # Long polling enabled for efficiency and cost reduction

  # Bounded retries: after 3 failed attempts, route automatically to the DLQ
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.evidence_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "ecopulse-evidence-queue"
    ManagedBy   = "terraform"
  }
}

# SQS Queue Policy: Allow EventBridge to publish messages to the evidence queue
resource "aws_sqs_queue_policy" "evidence_queue_policy" {
  queue_url = aws_sqs_queue.evidence_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeToSendMessage"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.evidence_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_bus.ecopulse.arn
          }
        }
      }
    ]
  })
}

# EventBridge Rule: Route EVIDENCE_PROCESSING_REQUESTED events directly to SQS
resource "aws_cloudwatch_event_rule" "evidence_processing_rule" {
  name           = "ecopulse-evidence-processing-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  description    = "Routes EVIDENCE_PROCESSING_REQUESTED domain events to the SQS evidence processing queue"

  event_pattern = jsonencode({
    detail-type = ["EVIDENCE_PROCESSING_REQUESTED"]
    source      = [{ prefix = "ecopulse" }]
  })
}

resource "aws_cloudwatch_event_target" "evidence_sqs_target" {
  rule           = aws_cloudwatch_event_rule.evidence_processing_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecopulse.name
  target_id      = "EvidenceProcessingSQS"
  arn            = aws_sqs_queue.evidence_queue.arn
}
