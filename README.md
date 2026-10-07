# EcoPulse — Environmental Community Accountability & Incentivization Platform

> **Core Architectural Principle:**  
> *"The mobile app displays state. The backend owns state. The event system records state changes. AI recommends actions. Humans approve consequential actions."*

EcoPulse is a production-grade environmental community platform featuring a native mobile application (iOS & Android) and a modular monolith backend designed to empower citizens to participate in verified ecological missions, earn auditable EcoPoints on an immutable ledger, build daily civic habits, and accumulate measurable community progress.

---

## 🏗 Monorepo Architecture

```
ecopulse/
├── apps/
│   ├── mobile/         # Native React Native + Expo App (Expo Router, TanStack Query, Zustand, SyncQueue)
│   ├── api/            # Modular Monolith Fastify + Drizzle ORM + PostgreSQL Backend
│   └── workers/        # Asynchronous event workers & cron runners
├── packages/
│   ├── types/          # Shared domain entities, DTOs, Enums, and API Contracts
│   ├── validation/     # Shared Zod validation schemas
│   ├── api-client/     # Isomorphic type-safe API client
│   ├── design-system/  # Editorial environmental color tokens, typography, and spacing
│   └── config/         # System configuration & environment constants
├── agents/             # Future Autonomous Agent Interfaces (Vision, Scoring, Maintenance, Community)
├── infrastructure/     # Terraform configurations for AWS deployment
└── docs/               # System Architecture Docs & ADRs (ADR-001 through ADR-005)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js `v20+` (v22 tested)
- pnpm `v9+` or `v11+`
- PostgreSQL `14+` running on localhost:5432

### 2. Environment Configuration
Copy `.env.example` to `.env` in the workspace root or pass standard environment variables:
```bash
cp .env.example .env
```
Default connection string: `postgres://localhost:5432/ecopulse`

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Setup & Seeding
```bash
# Run schema migrations to generate tables
pnpm db:migrate

# Seed development community, demo residents, maintainer, and missions
pnpm db:seed
```

### 5. Running the Stack
To start both the API server (port 4000) and Mobile app in development mode:
```bash
pnpm dev
```

Or run individual apps:
```bash
# Start backend API (http://localhost:4000)
pnpm --filter @ecopulse/api dev

# Start native Expo mobile app
pnpm --filter @ecopulse/mobile start
```

### 6. Running Tests & Quality Verification
```bash
# Run backend test suite (Vitest E2E test suite)
pnpm test

# Run TypeScript checks across all packages
pnpm typecheck
```

---

## 🧪 Demo Development Accounts

All demo accounts use password: `password123`

| Name | Role | Email | Starting Balance | Starting Streak |
| :--- | :--- | :--- | :--- | :--- |
| **Priya Sharma** | `RESIDENT` | `priya.sharma@example.com` | 340 pts | 12 days |
| **Aarav Patel** | `RESIDENT` | `aarav.patel@example.com` | 215 pts | 7 days |
| **Ananya Iyer** | `RESIDENT` | `ananya.iyer@example.com` | 520 pts | 19 days |
| **Suresh Kulkarni** | `MAINTAINER` | `maintainer@ecopulse.org` | — | PMC Officer |

---

## 🌿 The Vertical Slice Flow

1. **Register/Login**: Authenticate citizen and receive signed JWT.
2. **Join Community**: Citizen joins "Pune Green Community" (Kothrud Green Zone).
3. **Telemetry Dashboard**: Home screen queries `/me` and renders real computed EcoPoints balance, streak, active mission, and community progress.
4. **Mission Lifecycle**:
   - Citizen starts "Walk the Clean Route".
   - Citizen submits completion with `client_event_id` for idempotency.
   - Server verifies rules, logs `mission_events`, writes a credit record to `point_ledger`, updates `streaks`, and emits `MISSION_COMPLETED` domain event.
5. **Auditable Ledger**: Real-time balance updates calculated strictly from ledger transactions; double submissions are safely ignored.

---

## 📚 Architectural Decision Records (ADRs)

- [ADR-001: Modular Monolith First](docs/decisions/ADR-001-modular-monolith-first.md)
- [ADR-002: PostgreSQL as Source of Truth](docs/decisions/ADR-002-postgresql-as-source-of-truth.md)
- [ADR-003: Immutable Point Ledger](docs/decisions/ADR-003-immutable-point-ledger.md)
- [ADR-004: AI Recommendations Require Human Accountability](docs/decisions/ADR-004-ai-recommendations-require-human-accountability.md)
- [ADR-005: React Native + Expo for Mobile](docs/decisions/ADR-005-react-native-expo-for-mobile.md)
