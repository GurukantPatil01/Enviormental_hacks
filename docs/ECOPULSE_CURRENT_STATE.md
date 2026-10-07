# EcoPulse — Current State Audit (Phase 0)

> Date: 2026-10-02 · Baseline verified: `pnpm typecheck` ✅ (12/12 packages) · `pnpm --filter @ecopulse/api test` ✅ (35/35, Vitest against real Postgres)

This document records **what actually exists today**, before any new work. It is the reference for deciding what to reuse, refactor, or build. Nothing below is speculation — every claim was verified against source.

---

## 1. Repository & Tooling

| Area | State |
|---|---|
| Monorepo | pnpm workspaces + Turborepo (`apps/*`, `packages/*`, `agents/*`) |
| Backend | `apps/api` — Fastify modular monolith, Drizzle ORM, PostgreSQL 14+ (runs migrations on boot) |
| Mobile | `apps/mobile` — React Native 0.76 + Expo 52, Expo Router 4 (file-based routing), TanStack Query, Zustand |
| Workers | `apps/workers` — **stub only** (console.log placeholder) |
| Shared | `packages/types` (domain types), `packages/validation` (Zod), `packages/api-client` (typed fetch client), `packages/design-system` (colors/typography/spacing), `packages/config` |
| Agents | `agents/{vision,scoring,community,maintenance}` — interface stubs; real mock implementations live in `apps/api/src/agents/` |
| Infra | `infrastructure/terraform/main.tf` (AWS skeleton, not wired) |
| Docs | ADR-001…006 (modular monolith, Postgres source of truth, immutable ledger, AI human-accountability, RN+Expo, community intelligence) |
| Migrations | **Raw idempotent SQL in `apps/api/src/db/migrate.ts`** (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`), run at server boot and in tests. No drizzle-kit migration files. |
| Tests | `apps/api/test/` — 3 Vitest suites, 35 tests, all passing against real Postgres (`ecopulse_test`) |

**Environment note:** local Postgres has `ecopulse` + `ecopulse_test` databases. **PostGIS is NOT installed / not available as an extension** (`pg_available_extensions` has no postgis rows). Geographic architecture must account for this.

---

## 2. What Exists and Works (verified by tests)

### 2.1 Authentication & RBAC
- Email/password auth: bcrypt hashing, JWT (7d expiry) via `@fastify/jwt`, signed payload `{ id, email, role }`.
- `authenticate` + `requireRole(...roles)` middleware (`apps/api/src/middleware/auth.middleware.ts`).
- Routes: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- RBAC enforced on `/maintainer/*` (MAINTAINER, WARD_ADMIN, SUPER_ADMIN). Tested: resident → 403.
- Mobile: welcome → login/register → role-based redirect to `(resident)` or `(maintainer)` group.

### 2.2 Immutable Point Ledger (core, working)
- `point_ledger` table: `transaction_id`, `user_id`, `community_id`, `source`, `reference_id`, `amount`, `type (CREDIT|DEBIT)`, `approved_by`, `client_event_id` (UNIQUE), `metadata`.
- Idempotency: unique on `client_event_id` AND unique on `(user_id, source, reference_id)`.
- Balance = SQL SUM projection (`CREDIT` − `DEBIT`), never a stored mutable field. `lifetimeEarned` / `lifetimeSpent` computed.
- `pointsService.awardPoints()` checks both idempotency keys before insert; publishes `POINTS_AWARDED` → audit log.
- Sources in use: `MISSION_COMPLETED`, `VERIFIED_REPORT`, `COMMUNITY_MILESTONE` (seed grants), `INVALID_SUBMISSION`, `MANUAL_ADJUSTMENT`.
- Tested: duplicate `client_event_id` replay returns `ALREADY_COMPLETED`, zero points re-awarded; balance recomputed from ledger.

### 2.3 Missions
- Lifecycle: `AVAILABLE/ACTIVE → STARTED → COMPLETED` with `mission_participants` (unique per user+mission), `mission_events` (event log with idempotency key), `mission_verifications` (schema exists, barely used).
- `POST /missions`, `GET /missions/:id`, `POST /missions/:id/start`, `POST /missions/:id/complete` with `client_event_id` idempotency.
- Completion awards points + updates streak + publishes `MISSION_COMPLETED` → audit.
- Categories: CLEANLINESS, WASTE_SEGREGATION, TREE_PLANTING, ENERGY_SAVING, INSPECTION. Verification types: AUTOMATIC, PHOTO, PEER, MAINTAINER.
- **Gap:** `verificationType=AUTOMATIC` missions award points on self-reported completion with no evidence/QR/location gate (see §5).

### 2.4 Streaks
- `streaks` table (current, longest, last_activity_date YYYY-MM-DD). `streakService.recordActivity()` extends/breaks streak. Tested.

### 2.5 Reports → Evidence → Review → Task pipeline (working vertical slice)
- Reports: create/submit/list/get, category enum (WASTE_HOTSPOT, ILLEGAL_DUMPING, OVERFLOWING_BIN, MISSED_COLLECTION, MIXED_WASTE, OTHER), `location_geojson` JSONB, `client_event_id` idempotency.
- Evidence: upload via `LocalEvidenceStorage` (writes to local `/uploads`, storage abstraction interface exists for S3), `location_geojson`, verification status.
- AI advisory layer (advisory ONLY — verified): mock `VisionAgent` + `ScoringAgent` write `agent_runs` audit rows and `reviews` rows with `decision='PENDING'`, `requires_human_approval=true` default on `agent_actions`.
- Human review: `POST /reviews/:id/approve|reject|request-evidence` (MAINTAINER+) → transitions report status, credits `VERIFIED_REPORT` points idempotently. Tested: resident approve → 403; double approve → no double points.
- Tasks: create/assign/complete/verify (MAINTAINER+); task verify → linked report RESOLVED. Tested end-to-end.

### 2.6 Community Intelligence
- Communities: list/get/join/members. `boundary_geojson` JSONB polygon on communities (seeded with a real Kothrud-area polygon).
- `communityStateService`: 4-dimension score (behaviour, participation, service, environmental — each 0–100, weighted 25% each) → `overallProgress` + trend. Tested.
- Timeline: merged event stream (reports, tasks, milestones). Milestones: LOCKED/IN_PROGRESS/ACHIEVED with `target_progress` as % of community progress.
- Mobile Community tab renders state, timeline, milestones.

### 2.7 Domain Events & Audit
- In-process `eventBus` (subscribe/publish), ~30 event types declared in `packages/types`.
- `registerEventHandlers()` persists audit rows for every consequential event; evidence events kick off async AI processing.
- `audit_logs` table with actor, action, entity, before/after, reason.

### 2.8 Mobile App (resident)
- Auth flow: welcome/login/register (register sends `role: 'RESIDENT'` — correct client behavior today).
- Resident tabs: **Home, Community, Missions, Impact, Profile** + hidden routes: report, points, activity, mission/[id].
- Home: real balance, streak, active mission, recent activity, quick-report banner.
- Maintainer group: index (operations), incidents, tasks, timeline.
- Design system tokens used consistently (colors/spacing/typography/radius).

### 2.9 Offline
- `offline/SyncQueue.ts`: in-memory queue with retry + exponential backoff + `clientEventId` per mutation. **Not wired to any screen and not persisted** (lost on app restart).

---

## 3. What Is Partially Implemented

| Area | Current | Gap to target |
|---|---|---|
| `community_zones` table | Schema exists (name, code, JSONB boundary) | Never referenced by any service/route. Reuse as the base for **clusters**. |
| `community_projects` table | Schema exists (targetPoints/currentPoints, status IN_PROGRESS/UNLOCKED/COMPLETED) | No API, no screens. Status enum doesn't match required lifecycle (PROPOSED→APPROVED→IN_PROGRESS→COMPLETED / CANCELLED). |
| `community_metrics` table | Schema exists | Unused. |
| `mission_verifications` | Schema exists | Not part of completion flow. |
| `environmental_events` / `service_events` | Schema exists | No writers/readers. Perfect home for the Service-vs-Behaviour separation (§14 of spec). |
| `agents` / `agentRuns` / `agentActions` | Working for vision/scoring mock pipeline | Missing `agent_configs` (enable/disable), permission boundaries, community/operations/engagement agents. |
| Impact screen (`impact.tsx`) | Renders some stats from `/me` | Not the spec'd **Impact Passport** (no verified counts breakdown, credentials, milestones, QR activity). |
| Types | `ImpactSummary`, `nextMilestone`, `communityState` on dashboard declared | Me service doesn't populate them. |
| Home dashboard | Balance/streak/mission/activity | Missing: reward progress, cluster progress, nearby activity. |
| Seed data | 1 community, 1 maintainer, 6 residents, 3 missions, 2 reports, AI runs, tasks | No geographic hierarchy, no QR locations, no rewards, no clusters. |

---

## 4. What Is Missing Entirely

1. **Rewards system** — no tables, no API, no screens, no claim/fulfillment flow. (Largest product gap.)
2. **QR infrastructure** — no `qr_locations` / `qr_codes` / `qr_scan_events`, no scanner screen, no anti-abuse checks.
3. **Geographic hierarchy** — no cities / wards / clusters; no cluster membership, metrics, or detail. `community_zones` is an unused skeleton.
4. **Map** — no map screen or map API at all in the mobile app.
5. **Reward redemption ledger path** — no DEBIT writes anywhere; no atomic spend, no balance guard, no concurrency protection.
6. **Impact Passport / credentials** — no `impact_credentials` / `impact_events`.
7. **User-facing maintainership of rewards/projects** — no endpoints at all.
8. **Rate limiting** — no `@fastify/rate-limit` or equivalent anywhere.
9. **Notifications** — table/domain events exist conceptually; no delivery layer.
10. **Workers** — background job app is an empty shell; `job-queue.ts` exists in API (`apps/api/src/queue/job-queue.ts`) but is unused by routes.

---

## 5. What MUST Be Refactored / Fixed (violations & risks)

### 🔴 CRITICAL — Rule 1 violation (public role assignment)
- `packages/validation/src/index.ts`: `registerSchema` includes `role: z.enum(['RESIDENT','MAINTAINER','WARD_ADMIN','SUPER_ADMIN']).default('RESIDENT')`.
- `auth.service.register()` persists `input.role` **as supplied by the client**.
- Anyone can `POST /auth/register` with `role: "SUPER_ADMIN"` and receive an admin JWT.
- **Fix:** strip `role` from the public register schema; hard-code `RESIDENT` server-side; privileged roles assigned only via internal admin path + audit log. Tests must assert self-assignment is rejected.

### 🔴 HIGH — No redemption/debit safety
- `pointsService` only ever credits. Reward redemption needs: transactional debit + balance check + unique constraint per claim + serialization against concurrent spends (`SELECT … FOR UPDATE` / `SERIALIZABLE` / ledger-level balance guard). None exists.

### 🟠 MEDIUM — Mission completion trusts the client
- `verificationType: AUTOMATIC` + self-reported completion means points can be farmed with no location/QR/evidence. Spec: "Never award points solely because the client says an action was completed." Needs per-mission verification requirements (QR +/ GPS +/ evidence +/ human).

### 🟠 MEDIUM — Race window in `completeMission`
- Idempotency is check-then-insert without a DB transaction. Unique constraints backstop it, but a concurrent race surfaces as a 500 instead of a clean `ALREADY_COMPLETED`. Harden with a transaction and unique-violation mapping.

### 🟠 MEDIUM — Roles as a single column + long-lived JWT
- `users.role` (one row, no `user_roles`), role embedded in JWT for 7 days. Role changes take up to 7 days to propagate; no multi-role support. Fix during auth hardening (recheck role from DB on privileged routes or shorten token + `user_roles` table).

### 🟠 MEDIUM — JWT secret fallback
- `app.ts` falls back to a hard-coded dev secret if `JWT_SECRET` is unset. Acceptable in dev; must fail-fast in production.

### 🟡 LOW
- No rate limiting on auth or mutation endpoints.
- `reports.communityId` only — no ward/cluster association for geographic intelligence.
- Milestone `target_progress` is a vague % — spec wants count-based milestones ("1,000 verified actions").
- SyncQueue not persisted; not wired.
- Mobile `dist/` build artifacts and `.DS_Store` are committed (repo hygiene).
- `communities.current_progress` is a stored mutable integer (denormalized) — fine as a projection, but updates aren't driven by the ledger consistently.

---

## 6. What Can Be Reused As-Is (do not rebuild)

- ✅ Immutable `point_ledger` + balance projection + idempotency pattern (extend with DEBIT paths, don't replace).
- ✅ Event bus + audit-log handler pattern (extend with new events).
- ✅ Mission start/complete scaffolding and mission_events idempotency.
- ✅ Reports → evidence → review → task vertical slice and storage abstraction.
- ✅ AI advisory agents (mock) + `agent_runs`/`agent_actions` with `requires_human_approval` — exactly matches the "agents recommend, humans decide" principle.
- ✅ `requireRole` RBAC middleware, JWT auth, Zod validation layering, api-client error envelope.
- ✅ Community state scoring (will be reused per-cluster, not per-community only).
- ✅ Design system, Expo Router structure, TanStack Query wiring, SyncQueue concept (needs persistence).

---

## 7. Baseline Verification Commands

```bash
pnpm typecheck                  # ✅ 12/12
pnpm --filter @ecopulse/api test  # ✅ 35/35 (foundation 10, product 10, ai-observation 15)
pnpm db:migrate && pnpm db:seed # ✅ works against local Postgres
```
