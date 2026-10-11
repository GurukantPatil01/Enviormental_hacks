# 🌲 EcoPulse: Enterprise Cloud System Architecture

![EcoPulse Enterprise Cloud System Architecture](/Users/gurukantpatil/.gemini/antigravity-ide/brain/612cb676-90c7-4f43-b3aa-4420218185ea/ecopulse_architecture_diagram_1791720527981.jpg)

---

## 1. High-Level Architecture Overview

EcoPulse is an event-driven, AI-powered municipal environmental intelligence platform combining citizen participation, spatial analytics, and cloud orchestration.

```mermaid
graph LR
  subgraph Clients["1. Client Tier"]
    Mobile["📱 Mobile App (Expo / React Native)<br/>• Resident Reporting<br/>• Hotspots & Map<br/>• Reward Vouchers"]
    Web["🌐 Municipal Portal (React / Vite)<br/>• Pune Operations Center<br/>• Hotspot Radar<br/>• Crew Dispatch"]
  end

  subgraph CloudEdge["2. Cloud Edge & Hosting"]
    S3_Web["🪣 Amazon S3 Static Website<br/><code>ecopulse-portal-ap-southeast-2</code>"]
    Gateway["🔒 HTTPS Public Gateway<br/><code>thee-float-tiring.ngrok-free.dev</code>"]
  end

  subgraph BackendEngine["3. Application API Engine"]
    Fastify["⚡ Fastify API (Node.js 22)<br/>• JWT Authentication & RBAC<br/>• Spatial Clustering Engine<br/>• Presigned S3 Token Factory<br/>• Double-Entry Point Ledger"]
  end

  subgraph AWSBackbone["4. AWS Core Infrastructure (ap-southeast-2)"]
    S3_Priv["📦 Amazon S3 Private Bucket<br/><code>ecopulse-evidence-dev</code><br/>• AES256 Encrypted Photos<br/>• Presigned Direct Uploads"]
    EventBridge["⚡ Amazon EventBridge<br/>Bus: <code>ecopulse-events-dev</code><br/>• Asynchronous Domain Events"]
    SQS["📬 Amazon SQS & DLQ<br/>Queue: <code>ecopulse-evidence-queue-dev</code><br/>• Bounded Retries (Max 3)<br/>• 14-Day Dead-Letter Isolation"]
    CloudWatch["📊 Amazon CloudWatch<br/>Namespace: <code>EcoPulse/Intelligence</code><br/>• Metrics & Telemetry"]
    IAM["🔑 AWS IAM<br/>Least-Privilege Policies"]
  end

  subgraph AI_Data["5. AI & Data Intelligence Tier"]
    Gemini["🧠 Google Gemini Multimodal Vision<br/><code>gemini-3.5-flash-lite</code><br/>• ~1080ms Latency Detection<br/>• Waste Classification & Hazards"]
    Bedrock["🤖 Amazon Bedrock (Cloud Adapter)<br/>• Claude 3.5 Sonnet<br/>• Titan Vector Embeddings"]
    Neon["🐘 PostgreSQL 16 + PostGIS + pgvector<br/>• 6 Pune Clusters (Kothrud, Swargate)<br/>• 550m Radar Hotspots<br/>• Immutable Audit Ledger"]
  end

  Web -. "Hosted at Edge" .-> S3_Web
  Web --> Gateway
  Mobile --> Gateway
  Mobile -- "Presigned Direct Photo Upload" --> S3_Priv
  Gateway --> Fastify

  Fastify --> S3_Priv
  Fastify --> EventBridge
  EventBridge --> SQS
  Fastify --> CloudWatch
  Fastify --> IAM

  Fastify -- "Active Multimodal Vision" --> Gemini
  Fastify -. "Alternative Foundation Model" .-> Bedrock
  Fastify --> Neon
```

---

## 2. Ingestion & Storage Pipeline (Zero Credential Leakage)

```mermaid
sequenceDiagram
  autonumber
  actor Citizen as 📱 Citizen (Priya)
  participant App as Mobile App
  participant API as Fastify API
  participant S3 as Amazon S3 (ecopulse-evidence-dev)
  participant AI as Gemini Vision Engine
  participant DB as PostGIS + Point Ledger

  Citizen->>App: 1. Snaps photo of illegal waste dump
  App->>API: 2. Requests presigned upload URL (filename, mime)
  API->>S3: Issues cryptographic PutObjectCommand (15 min validity)
  S3-->>API: Returns signed AWS S3 URL
  API-->>App: Returns signed URL (Zero secret keys exposed)
  App->>S3: 3. Streams raw image bytes directly to Amazon S3
  App->>API: 4. Submits report (GPS coordinates + S3 storage key)
  API->>AI: 5. Dispatches image bytes for multimodal analysis
  AI-->>API: Waste Type: ILLEGAL_DUMPING, Severity: HIGH, Confidence: 94%
  API->>DB: 6. Clusters into Pune Hotspot & credits +15 points to Ledger
  API-->>App: Report created, Points awarded, Streak updated
```

---

## 3. Event-Driven Asynchronous Pipeline (EventBridge + SQS DLQ)

```mermaid
flowchart TD
  ReportEvent["📡 Report Submitted<br/>(EVIDENCE_PROCESSING_REQUESTED)"] --> EB["⚡ Amazon EventBridge<br/>Bus: ecopulse-events-dev"]

  EB --> Rule1["EventBridge Rule<br/>(Detail: EVIDENCE_PROCESSING_REQUESTED)"]
  Rule1 --> SQS["📬 Amazon SQS Primary Queue<br/>ecopulse-evidence-queue-dev"]

  SQS --> Worker["⚙️ Async Processing Worker"]
  Worker --> AI_Task["🧠 Multimodal AI Vision Analysis"]

  AI_Task -->|Success| DB_Save["💾 Persist to PostgreSQL<br/>(ai_observations & environmental_events)"]
  AI_Task -->|Transient Failure| Retry["🔄 Retry Attempt (Up to 3x)"]
  Retry --> SQS

  Retry -->|Exceeded Max Attempts| DLQ["☠️ Amazon SQS Dead-Letter Queue (DLQ)<br/>ecopulse-evidence-dlq-dev<br/>(14-Day Quarantine for Operator Inspection)"]

  Worker --> CW["📊 Amazon CloudWatch Metrics<br/>• Evidence.Uploaded<br/>• AI.InferenceDuration<br/>• Queue.DLQRouted"]
```

---

## 4. Municipal Operations & Hotspot Clustering

```mermaid
flowchart LR
  subgraph CitizenReports["Citizen Reports"]
    R1["Report 1: Kothrud (18.5074, 73.8077)"]
    R2["Report 2: Deccan (18.5150, 73.8410)"]
    R3["Report 3: Swargate (18.4988, 73.8570)"]
  end

  subgraph SpatialClustering["PostGIS Spatial Clustering Engine"]
    BBOX["Spatial Bounding Box & Ray Casting"]
    Radius["550-meter Proximity Evaluation"]
    Clustering["Neighborhood Density Weighting"]
  end

  subgraph PuneClusters["6 Pune Municipal Clusters"]
    C1["🔴 Kothrud Cluster (Active Radar)"]
    C2["🔴 Shivaji Nagar Cluster"]
    C3["🔴 Swargate Cluster"]
    C4["🔴 Hadapsar Cluster"]
    C5["🔴 Viman Nagar Cluster"]
    C6["🔴 Katraj Cluster"]
  end

  subgraph Interventions["Municipal Operations"]
    AdminPortal["🌐 AWS S3 Operations Portal"]
    Dispatch["👷 Dispatch PMC Sanitation Crew"]
    Resolution["✅ Mark Cleanup Complete (Before/After)"]
  end

  CitizenReports --> SpatialClustering
  SpatialClustering --> PuneClusters
  PuneClusters --> AdminPortal
  AdminPortal --> Dispatch --> Resolution
```

---

## 5. AWS Services Inventory

| # | AWS Service | Resource Name / Identifier | Purpose & Architecture Role |
| :---: | :--- | :--- | :--- |
| **1** | **Amazon S3 (Web Hosting)** | `ecopulse-portal-ap-southeast-2` | Hosts the static production municipal web portal at `http://ecopulse-portal-ap-southeast-2.s3-website-ap-southeast-2.amazonaws.com`. |
| **2** | **Amazon S3 (Evidence Storage)** | `ecopulse-evidence-dev` | Private encrypted storage for citizen evidence photos, drone scans, and audit documents. |
| **3** | **Amazon S3 (Presigned URLs)** | `@aws-sdk/s3-request-presigner` | Cryptographic presigned URL factory allowing mobile clients to upload directly to S3 without AWS credentials. |
| **4** | **Amazon EventBridge** | `ecopulse-events-dev` | Custom serverless event bus routing domain events (`REPORT_CREATED`, `EVIDENCE_PROCESSING_REQUESTED`). |
| **5** | **Amazon SQS** | `ecopulse-evidence-queue-dev` | Message queue buffering evidence processing jobs with long-polling and bounded retry policies. |
| **6** | **Amazon SQS (DLQ)** | `ecopulse-evidence-dlq-dev` | Dead-letter queue isolating poisoned or corrupted uploads after 3 failed retries. |
| **7** | **Amazon CloudWatch** | Namespace: `EcoPulse/Intelligence` | Captures operational metrics (`Evidence.Uploaded`, `AI.InferenceDuration`, `Queue.DLQRouted`) with 7-day log retention. |
| **8** | **AWS IAM** | User: `ecopulse-s3-user`<br/>Account: `730012679620` | Identity-based least-privilege security access control. |
| **9** | **Amazon Bedrock (Adapter)** | `anthropic.claude-3-5-sonnet` / `amazon.nova-lite-v1:0` | Multimodal foundation model adapter and Titan embedding provider (`amazon.titan-embed-text-v1`). |
