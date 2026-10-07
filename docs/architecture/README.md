# EcoPulse System Architecture & Technical Specifications

> **Core Principle**:  
> *"The mobile app displays state. The backend owns state. The event system records state changes. AI recommends actions. Humans approve consequential actions."*

---

## 1. Executive Summary

**EcoPulse** is a production-grade environmental community platform designed for citizen incentivization, verifiable accountability, and automated ecological maintenance. It bridges native mobile users (Residents, Maintainers, Ward Admins) with municipal operations, future drone surveillance, and generative AI agents.

---

## 2. Monorepo & System Topology

EcoPulse is organized as a high-performance TypeScript monorepo governed by **pnpm workspaces** and **Turborepo**:

```
ecopulse/
├── apps/
│   ├── mobile/         # Native iOS & Android application (Expo, Expo Router, TanStack Query, Zustand)
│   ├── api/            # Modular Monolith Backend (Fastify, Drizzle ORM, PostgreSQL)
│   └── workers/        # Asynchronous domain event consumers & scheduled task runners
├── packages/
│   ├── types/          # Shared domain models, enums, DTOs & API contracts
│   ├── validation/     # Shared Zod validation schemas (isomorphic)
│   ├── api-client/     # Universal type-safe API client consuming backend endpoints
│   ├── design-system/  # Environmental token hierarchy, color scales, typography & styles
│   └── config/         # Common app configurations & environments
├── agents/             # Future autonomous agent stubs (Vision, Scoring, Maintenance, Community)
├── infrastructure/     # Terraform configurations for future AWS deployment
└── docs/               # Architecture documents and Architecture Decision Records (ADRs)
```

---

## 3. Core Architectural Layers

### 3.1 Backend Architecture (Modular Monolith)
- **Fastify Framework**: Sub-millisecond routing, low overhead, JSON schema support.
- **Strict Layered Boundary**:
  $$\text{Route Handler} \longrightarrow \text{Controller / Service} \longrightarrow \text{Repository} \longrightarrow \text{PostgreSQL (Drizzle)}$$
  - Route handlers handle HTTP request validation (`Zod`).
  - Services orchestrate domain logic, streak rules, ledger mutations, and event emissions.
  - Repositories encapsulate database queries.
  - No database logic ever leaks into routes.
- **Role-Based Access Control (RBAC)**:
  - Roles: `RESIDENT`, `MAINTAINER`, `WARD_ADMIN`, `SUPER_ADMIN`.
  - Enforced via JWT authorization middleware at the route level. Server always derives authorization from claims; client role headers are strictly ignored.

### 3.2 Authoritative Immutable Point Ledger
- **No `users.points` column**: Avoids race conditions, silent mutations, and data corruption.
- Every point creation, deduction, or bonus is appended to `point_ledger` with:
  - `transaction_id`: Cryptographic identifier
  - `source`: Domain event cause (`MISSION_COMPLETED`, `VERIFIED_REPORT`, `COMMUNITY_MILESTONE`)
  - `reference_id`: Foreign reference (e.g. mission UUID)
  - `amount`: Points value
  - `type`: `CREDIT` or `DEBIT`
  - `client_event_id`: Unique idempotency key to prevent double-crediting
- Balances are computed deterministically:
  $$\text{Balance} = \sum_{\text{type} = \text{CREDIT}} \text{amount} - \sum_{\text{type} = \text{DEBIT}} \text{amount}$$

### 3.3 Streak Engine
- Tracks consecutive days of citizen activity without allowing spoofing or double-counting within the same 24-hour window.
- Grace period support: activities within 24–36 hours increment the streak counter. Gaps greater than 36 hours reset the active streak to 1 while preserving `longest_streak`.

### 3.4 Domain Event Architecture
- Domain mutations emit strongly typed events over an in-memory `DomainEventBus`:
  - `USER_REGISTERED`
  - `COMMUNITY_JOINED`
  - `MISSION_STARTED`
  - `MISSION_COMPLETED`
  - `POINTS_AWARDED`
  - `STREAK_EXTENDED`
- All events automatically generate structured records in `audit_logs` capturing `before`, `after`, and `actor_id`.
- Designed for zero-downtime migration to AWS EventBridge / SQS in future phases.

---

## 4. Mobile Architecture (React Native + Expo)

- **Platform**: React Native with Expo SDK (running on iOS and Android native runtimes).
- **Navigation**: Expo Router (file-based routing with nested route groups: `(auth)`, `(resident)`, `(maintainer)`).
- **Server State**: **TanStack Query** (React Query) handles caching, background re-fetching, and optimistic updates.
- **Client State**: **Zustand** stores session tokens and transient client flags.
- **Offline-First Preparation**: `SyncQueue` abstraction guarantees that mutations executed offline queue idempotency keys (`client_event_id`) and replay with exponential backoff once reconnected.

---

## 5. Future Agent & Drone Architecture

1. **Drone Agent**: Periodic aerial photogrammetry over community zones to calculate waste accumulation and canopy coverage index.
2. **Vision Agent**: Multimodal deep learning (AWS Bedrock / Claude / YOLO) to verify uploaded citizen evidence.
3. **Scoring Agent**: Dynamic Community Pulse computation based on real-time municipal response and participation density.
4. **Maintenance Agent**: Predictive dispatch recommendations for municipal sanitation trucks.
5. **Human-in-the-Loop Principle**: All consequential actions (issuing civic fines, unlocking capital community budgets, penalizing users) require affirmative human maintainer approval.
