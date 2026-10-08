# Amazon Bedrock Integration Guide

## 1. Overview

Amazon Bedrock provides access to foundation models such as Anthropic Claude 3.5 Sonnet and Amazon Titan. In EcoPulse, Bedrock is an **optional adapter** behind `VisionAIProvider`, `EmbeddingProvider`, and `AgentReasoningProvider`.

**Crucial Note:** Bedrock is **never required** to build, test, or run EcoPulse. The system functions with 100% test coverage using local mock providers.

---

## 2. Configuration & Activation

### Environment Variables
Configure the following in `.env` to switch from mock to Bedrock:

```bash
# Enable Bedrock Vision Analysis
AI_PROVIDER=bedrock
BEDROCK_REGION=ap-south-1 # or us-east-1 if model access is enabled there
BEDROCK_VISION_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Optional: Enable Bedrock Embeddings (Otherwise uses local 384d model)
EMBEDDING_PROVIDER=bedrock
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v1

# AWS Credentials (Standard AWS SDK v3 credential resolution)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
```

### Disabling Bedrock (Zero-Cost Local Mode)
To disable Bedrock and ensure zero AWS billing:
```bash
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

---

## 3. Required IAM Permissions

To invoke Bedrock models, the calling IAM user or Lambda execution role requires the following least-privilege policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-*"
      ]
    }
  ]
}
```

---

## 4. Expected Costs & Usage Tips

- **Claude 3.5 Sonnet:**
  - Input: ~$3.00 per million tokens (text + images)
  - Output: ~$15.00 per million tokens
  - *Recommendation:* Cache repeated observations and use downscaled JPEG images (max 1024x1024) to minimize token consumption.
- **Claude 3 Haiku (Budget Alternative):**
  - Input: ~$0.25 per million tokens
  - Output: ~$1.25 per million tokens
  - *Recommendation:* Ideal for fast preliminary classification of citizen photos.
- **Titan Embeddings:**
  - ~$0.02 per 1,000 requests.

---

## 5. Graceful Fallback Behavior

Both `BedrockVisionProvider` and `BedrockEmbeddingProvider` implement defensive fallback mechanisms:
- If Bedrock credentials are not present, an invalid region is specified, or model access has not been granted in the AWS account, the adapters log a warning and fall back to `MockVisionProvider` / `MockEmbeddingProvider` without throwing fatal unhandled rejections.
- LLM outputs are always validated via `environmentalObservationSchema`. If a foundation model outputs malformed JSON or omits required fields, the fallback heuristics provide safe default values.
