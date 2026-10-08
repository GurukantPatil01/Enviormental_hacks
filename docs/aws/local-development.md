# Local Development Guide

## 1. Zero-Cost, Offline-First Principle

EcoPulse does **not require AWS credentials, an AWS account, or an active internet connection** for full local development and testing.

When running with `APP_ENV=local`:
- **Storage:** Local filesystem (`LocalObjectStorage` writing to `./uploads`)
- **Event Bus:** In-memory synchronous dispatch (`LocalEventBus`)
- **AI Models:** Deterministic simulation (`MockVisionProvider`, `MockEmbeddingProvider`, `MockAgentProvider`)
- **Vector Search:** Local PostgreSQL with `pgvector` (or fallback)
- **Telemetry:** Console stdout logger (`LocalObservability`)

---

## 2. Quickstart

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL >= 15 (with `postgis` and `vector` extensions)

### Setup Steps
```bash
# 1. Clone & install dependencies
pnpm install

# 2. Configure local environment
cp .env.example .env

# Verify that APP_ENV=local in .env:
# APP_ENV=local
# DATABASE_URL=postgres://localhost:5432/ecopulse

# 3. Run database migrations
pnpm db:migrate

# 4. Run automated test suite (all tests execute locally without AWS)
pnpm --filter @ecopulse/api test

# 5. Start local API server
pnpm --filter @ecopulse/api dev
```

---

## 3. Switching Between Local and AWS Modes

To toggle between environments, update `APP_ENV`:

```bash
# Local Mode (Default - Zero AWS Cost)
APP_ENV=local
STORAGE_PROVIDER=local
EVENT_BUS_PROVIDER=local
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock

# AWS Cloud Mode (Requires configured AWS credentials)
APP_ENV=aws
STORAGE_PROVIDER=s3
EVENT_BUS_PROVIDER=eventbridge
AI_PROVIDER=bedrock # Optional: see docs/aws/bedrock.md
AWS_REGION=ap-south-1
S3_BUCKET_NAME=ecopulse-storage-dev
EVENT_BUS_NAME=ecopulse-events-dev
```
