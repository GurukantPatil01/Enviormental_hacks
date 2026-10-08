# EcoPulse AWS Cloud Services Mapping

## 1. Cloud Architecture Philosophy

EcoPulse uses AWS as an elastic serverless infrastructure and event backbone, keeping core business intelligence inside our self-hosted models, algorithms, and PostgreSQL engine.

### Service Allocation Table

| AWS Service | EcoPulse Usage | Why Chosen | Cost Strategy |
|---|---|---|---|
| **Amazon S3** | Storage of citizen evidence images, drone orthomosaics, and analysis logs | Highly scalable, private presigned URL access | Lifecycle expiration on temporary files; Glacier transition after 90 days |
| **Amazon EventBridge** | Decoupled domain event routing between microservices | Native serverless fanout; zero idle cost | Charged per 1M events (~$1.00); zero base cost |
| **AWS Lambda** | Asynchronous processors (`reportProcessor`, `aiProcessor`, `embeddingProcessor`, `hotspotProcessor`) | On-demand scaling; executes only when events occur | Generous free tier (1M requests/mo); zero idle server costs |
| **Amazon CloudWatch** | Structured logs, error alarms, latency telemetry | Centralized operational observability | 7-day log retention in dev; minimal custom metrics |
| **AWS IAM** | Least-privilege roles for Lambdas & API services | Strict security boundaries | Free |
| **Amazon Bedrock (Optional)** | Multimodal evidence evaluation & reasoning | High-accuracy foundation models | Fully behind provider abstraction; disabled in local development |

---

## 2. Intentional Exclusions (Non-Goals)

To prevent budget overrun and maintain hackathon cost discipline, the following services are **strictly avoided**:
- **NO EC2 / Lightsail:** No always-running virtual machines incurring hourly billing.
- **NO Amazon OpenSearch Serverless:** Avoided ~$700/mo minimum OCU billing by using PostgreSQL `pgvector`.
- **NO Amazon RDS without approval:** The backend supports standard PostgreSQL running locally or on serverless databases (e.g. Neon free tier).
- **NO MSK / Kafka:** EventBridge provides sufficient throughput with zero maintenance overhead.
