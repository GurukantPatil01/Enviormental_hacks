# EcoPulse — Product & Technical Roadmap

> Companion to [ECOPULSE_CURRENT_STATE.md](./ECOPULSE_CURRENT_STATE.md). This roadmap defines the target architecture and the phased plan to get there without breaking what works.

---

## 1. Target Architecture (one paragraph)

The mobile app displays state; the backend owns state. All consequential mutations flow through Fastify route → service → repository with Zod validation, JWT auth, RBAC, and audit. Economic truth lives in the immutable `point_ledger` (credits from verified actions, debits from atomic reward redemptions). Verification truth is composed from signals — QR scans, GPS proximity, evidence, human review — captured as verification events, never from client assertions. Geographic truth lives in the City → Ward → Community → Cluster → User hierarchy with real polygon boundaries (GeoJSON now, PostGIS-ready schema), which powers the Map and cluster intelligence. Rewards convert verified participation into tangible benefits under maintainer governance. AI agents remain advisory: observe → interpret → recommend → human review → execute, with every run audited and no path from agent output to an irreversible state change.

---

## 2. Database Changes (by phase)

Migration strategy: keep the existing idempotent-SQL approach in `runMigrations()` but evolve it into **ordered, named migration blocks** (tracked in a `schema_migrations` table) so each phase adds a reviewable block without drizzle-kit churn.

### Phase 1 — Geographic foundation
- `cities` (name, state, country, center, boundary)
- `wards` (city_id, code, name, boundary)
- `clusters` (community_id, ward_id, code e.g. `KTH-07`, name, boundary GeoJSON polygon, center point, bbox columns min/max lat/lng for prefiltering, status)
  - `community_zones` is retired (empty table, never referenced) or dropped — **no duplicate concepts**.
- `cluster_members` (cluster_id, user_id, joined_at) — one primary cluster per user
- `cluster_metrics` (cluster_id, metric_key, metric_value, period, recorded_at) — environment / participation / service / incidents / progress
- `reports.ward_id`, `reports.cluster_id` (nullable, backfilled from location)
- `missions.cluster_id` (nullable — community-wide missions remain valid)
- Spatial capability on stock Postgres: bbox + GiST/btree indexes, haversine distance SQL, ray-casting point-in-polygon SQL function, membership assignment by polygon containment. **PostGIS-compatible column layout so a later `geom geometry(Polygon,4326)` swap is a backfill migration, not a rewrite.**

### Phase 2 — Identity (Impact Passport)
- `impact_credentials` (user_id, code, title, description, issued_at, revoked_at, metadata) — evidence-backed badges
- `impact_events` (user_id, event_type, reference_type, reference_id, occurred_at, metadata) — append-only participation history (verified missions, reports, QR checks, milestones contributed)
- `resident_profiles.ward_id`, `resident_profiles.city_id` (public geography: city/ward/community/cluster only — **never** street address)

### Phase 3 — QR infrastructure
- `qr_locations` (code e.g. `KTH-BIN-014`, name, type: COLLECTION_POINT | RECYCLING | PROJECT | CHECKPOINT | PARTNER, cluster_id, location GeoJSON point, address_ref, instructions, status, created_by)
- `qr_codes` (location_id, token_hash (SHA-256), payload version, issued_at, expires_at, revoked_at, rotation) — printed codes store only hashes
- `qr_scan_events` (user_id, qr_location_id, client_event_id UNIQUE, scanned_at, gps GeoJSON point, gps_accuracy_m, distance_m, within_tolerance bool, mission_id nullable, evidence_id nullable, result: ACCEPTED | DUPLICATE | OUT_OF_RANGE | INVALID | RATE_LIMITED, metadata) — append-only verification signal

### Phase 4 — EcoPoints + Rewards
- `point_ledger`: extend `source` enum values (`QR_VERIFIED_ACTION`, `REWARD_REDEMPTION`, `REVERSAL`, `BONUS`); add `reward_claim_id` reference (nullable). Add `CHECK (amount > 0)` — sign carried by `type`.
- `reward_partners` (name, contact, notes, status)
- `rewards` (partner_id, title, description, category: FOOD | ENTERTAINMENT | LOCAL | EXPERIENCES | SUSTAINABILITY | EDUCATION | OTHER, cost_points, inventory_total, inventory_remaining, redemption_instructions, image_url, terms, status: DRAFT | ACTIVE | PAUSED | OUT_OF_STOCK | EXPIRED | ARCHIVED, available_from, available_until, created_by)
- `reward_claims` (reward_id, user_id, client_event_id UNIQUE, cost_points, status: CLAIMED | PENDING | APPROVED | FULFILLED | CANCELLED | REJECTED, redemption_code_hash, claimed_at, decided_by, decided_at, fulfilled_by, fulfilled_at, notes)
- Claim + debit in **one DB transaction** with balance guard; idempotent on `client_event_id`; audited at every transition.

### Phase 5 — Map + community intelligence
- Mostly read-model work: map query APIs over clusters/QR locations/reports/missions; `cluster_metrics` history for trend charts.

### Phase 6 — Community projects
- Evolve `community_projects`: add `cluster_id`, `proposed_by`, `approved_by`, `approved_at`, `status → PROPOSED | APPROVED | IN_PROGRESS | COMPLETED | CANCELLED`, `impact_metrics` JSONB.
- `community_milestones`: add `metric_type` + `metric_target` (count-based, e.g. 1,000 verified actions), keep display fields.
- `milestone_progress` projection table (milestone_id, current_value, updated_at).

### Phase 7 — Agent foundation
- `agent_configs` (agent_type, enabled bool, provider, model, config JSONB, max_actions_per_day, updated_by) — agents default **disabled**.
- Extend `agent_actions` with `authorization_scope` and ensure every write path checks it.

---

## 3. API Changes (by phase)

All new routes follow the existing envelope (`{ data }` / `{ error }`), Zod validation, and `preHandler` guards.

| Phase | Endpoint | Auth | Purpose |
|---|---|---|---|
| 0 | — | — | `POST /auth/register` hardened: role stripped server-side (no API shape change; breaking change for attackers only) |
| 1 | `GET /geo/cities · /wards · /clusters` | public/auth | hierarchy browsing |
| 1 | `POST /geo/resolve-location` | auth | lat/lng → containing ward/cluster (point-in-polygon) |
| 1 | `GET /clusters/:id` | auth | cluster detail: metrics, milestone, trend, recent activity |
| 1 | `GET /clusters/:id/members · /metrics-history` | auth | member count (no PII), metric time series |
| 1 | `GET /map/overview` | auth | clusters + signals within viewport/bbox |
| 2 | `GET /me/passport` | auth | Impact Passport aggregate |
| 2 | `GET /users/:id/public-profile` | auth | least-privilege public identity (city/ward/community/cluster, verified counts — no address) |
| 3 | `POST /qr/scan` | auth | structured scan event; validates token, GPS, rate, duplicates |
| 3 | `GET /qr/locations · /qr/locations/:id` | auth | nearby/cluster QR registry |
| 3 | `POST /maintainer/qr/locations` (+PUT/DELETE) | MAINTAINER+ | registry management, audited |
| 4 | `GET /rewards` (+filters: category, available) | auth | catalog with availability |
| 4 | `GET /rewards/:id` · `GET /rewards/categories` | auth | detail |
| 4 | `POST /rewards/:id/claim` | auth | **atomic** debit + claim, idempotent |
| 4 | `GET /me/reward-claims` | auth | claim history + redemption codes |
| 4 | `POST /maintainer/rewards` (+PATCH, lifecycle transitions) | MAINTAINER+ | catalog governance, audited |
| 4 | `GET /maintainer/reward-claims` · `POST /maintainer/reward-claims/:id/approve|fulfil|cancel` | MAINTAINER+ | fulfillment, audited |
| 5 | `GET /map/clusters` · `GET /map/reports` · `GET /map/qr-locations` | auth | map layers with privacy filters |
| 6 | `GET /clusters/:id/projects · /milestones` | auth | visibility |
| 6 | `POST /projects/:id/feedback` | auth | participation |
| 6 | `POST /maintainer/projects` (+approve/start/complete/cancel) | MAINTAINER+ | governance, audited |
| 7 | `GET /agents/configs` · `POST /agents/configs/:id` | WARD_ADMIN+ | enable/disable agents |
| 7 | `GET /maintainer/agent-actions` · approve/reject endpoints | MAINTAINER+ | human review queue |
| 7 | `POST /maintainer/users/:id/roles` | WARD_ADMIN+ | **only** privileged role-assignment path, audited |

---

## 4. Mobile Changes

- **Tab bar → HOME · MAP · MISSIONS · REWARDS · ME** (spec §18). Current Community tab folds into MAP + cluster detail; Impact folds into ME (passport).
  - `(resident)/index` Home (existing, extended: reward progress, cluster progress, nearby activity)
  - `(resident)/map` **new** — cluster polygons + signals; interactivity first (React Native maps lib), polygon rendering per platform
  - `(resident)/missions` (existing) + mission detail gains QR + location + evidence submission steps
  - `(resident)/rewards` **new** — catalog, categories, detail, claim flow (balance before/after confirm), claims list
  - `(resident)/profile` → ME — passport, points, streak, claims, cluster
  - Contextual: report (exists), QR scanner (new modal/camera), notifications, history
- Maintainer app (existing group) extended with: rewards management, claim fulfillment, QR registry, project approval, review queue.
- Offline: persist SyncQueue (AsyncStorage/MMKV), queue reports + mission evidence, idempotent replay via existing `client_event_id` convention. Cached missions/rewards via TanStack Query persistence.
- QR scanner: `expo-camera`, scan → `POST /qr/scan` with current GPS; server decides result; UI reflects ACCEPTED/DUPLICATE/OUT_OF_RANGE.

## 5. Map Architecture
- Data: clusters (polygon + center + bbox + metrics snapshot), QR locations (points), reports (points, **fuzzed/cluster-level for non-owners**), missions, projects.
- Query: bbox prefilter via indexes → precise polygon containment server-side → viewport aggregation.
- Semantics: clusters colored by composite state (environment/participation/service/incidents/progress) — community-level performance only, never individual shaming.
- Layers toggleable; detail drill-down to `clusters/:id` page.
- PostGIS upgrade path documented (§2 Phase 1).

## 6. QR Architecture
- Printed/installed codes contain a signed public token: `ecopulse:v1:<locationCode>:<secret>`; server stores SHA-256 hash. Rotation + revocation supported.
- Scan flow: camera scan → `POST /qr/scan {token, gps, accuracy, clientEventId, missionId?}` → validate token → check GPS distance vs location tolerance → rate/duplicate checks → append `qr_scan_events` with structured result.
- A scan is **one signal**, never automatic proof. Mission verification engine combines configured signals per mission: QR + GPS + evidence + human review.
- Anti-abuse: per-user-per-location rate limits, duplicate window, impossible-travel heuristic (distance/time), excessive same-QR flagging → flags surface to maintainers; never auto-punish.

## 7. Reward Architecture
- Lifecycle (reward): DRAFT → ACTIVE → PAUSED/OUT_OF_STOCK → EXPIRED/ARCHIVED (maintainer-only transitions, audited).
- Lifecycle (claim): CLAIMED → PENDING → APPROVED → FULFILLED; CANCELLED/REJECTED restores inventory + optionally reverses the debit via a `REVERSAL` ledger entry (idempotent).
- Claim algorithm (single SQL transaction):
  1. `SELECT ... FOR UPDATE` reward row (or serializable tx)
  2. Check status=ACTIVE, window, `inventory_remaining > 0`
  3. Compute balance from ledger; reject `INSUFFICIENT_BALANCE` if < cost
  4. Insert claim (unique `client_event_id`; unique active claim per user+reward)
  5. Insert negative ledger entry `REWARD_REDEMPTION` referencing the claim
  6. Decrement inventory; audit; emit events
- Redemption: approved claims get a hashed redemption code; partner-facing code validation is a maintainer action. No partner secrets exposed to users.

## 8. Identity Architecture (Impact Passport)
- Aggregate of **evidence-backed facts only**: member since, primary community/cluster/ward/city, verified missions/reports/QR interactions counts (from `impact_events`/ledger), points earned vs redeemed, current streak, milestones contributed, credentials, participation timeline.
- No arbitrary trust score. Counts are computed from real records; credentials issued by system rules (e.g. "First 10 verified actions") or maintainers, revocable, audited.
- Public profile = city/ward/community/cluster + verified contribution counts. Residential address never leaves the owner's own view.

## 9. Maintainer Architecture
- Existing `(maintainer)` mobile group + `/maintainer/*` API extended; one guard: `requireRole('MAINTAINER','WARD_ADMIN','SUPER_ADMIN')`.
- Every consequential action (reward create/transition, claim decision, QR registry change, project transition, role assignment) → `audit_logs` via the existing event-bus handler pattern.
- Normal users can never reach maintainer capabilities: RBAC middleware + role checks inside services (defense in depth).

## 10. Future Agent Architecture
- Four agents (Observation, Community, Operations, Engagement) as **config-gated, advisory-only** modules following the existing vision/scoring pattern: observe → interpret → recommend → human review → execute.
- `agent_configs` default disabled; runs audited in `agent_runs`; actions land in `agent_actions` with `requires_human_approval=true`.
- Hard boundaries (enforced by code review + tests): agents cannot award/revoke points, approve claims/projects, change roles, mutate authoritative environmental records, or bypass RBAC (agent routes require a human principal).
- Workers app becomes the execution host for queued agent jobs + notification fanout (keeping the API request path clean).

## 11. Security
- Fix public role assignment (server-side forced `RESIDENT`; only internal role-assignment endpoint, WARD_ADMIN+, audited).
- Move to `user_roles` support with role re-check from DB on privileged routes (JWT role staleness ≤ 7d is unacceptable for admin ops).
- Rate limiting: `@fastify/rate-limit` on auth (strict), QR scan, report create, claim endpoints.
- Idempotency retained everywhere via `client_event_id` unique constraints (existing pattern).
- Fail-fast on missing `JWT_SECRET` outside development.
- Input validation: Zod on every route (existing convention).
- Transaction safety: claims, redemptions, and completions wrapped in DB transactions; unique-constraint races mapped to clean 200/idempotent responses.
- Ledger integrity: append-only, positive amounts + typed sign, balance always projected from ledger.

## 12. Privacy
- Public identity: CITY / WARD / COMMUNITY / CLUSTER only. `locationAddress` on reports is operational data shown to maintainers, not a public profile field.
- Map shows cluster-level and fuzzed report locations; exact evidence coordinates only for owner + maintainers.
- Least-privilege exposures documented per endpoint in the test plan.
- GPS from QR scans is stored for verification only, not displayed to other users.

## 13. Test Plan (additions; keep all 35 existing green)

- **AUTH:** signup forces RESIDENT; submitting `role=MAINTAINER/SUPER_ADMIN` is ignored/rejected; internal role-assignment requires WARD_ADMIN+ and is audited; resident cannot hit any maintainer route (already partially covered).
- **ECOPOINTS:** verified action awards once (existing); duplicate event no double award (existing); ledger immutability (no UPDATE/DELETE path + test); reward redemption deducts atomically; insufficient balance rejected; **concurrent redemptions cannot overspend** (Promise.all race test); reversal restores balance exactly once.
- **REWARDS:** claim active reward; unavailable (paused/out-of-stock) rejected; expired rejected; user cannot create/approve rewards (403); maintainer can manage; inventory decrements; claim idempotency.
- **QR:** valid scan creates event; duplicate scan → DUPLICATE; invalid token → INVALID; GPS out of tolerance → OUT_OF_RANGE; scan alone ≠ verified action (no points without mission completion rules).
- **MAP/GEO:** cluster lookup by point-in-polygon; user membership assignment; spatial/bbox queries return correct clusters; public endpoints don't leak addresses or member PII.
- **PROJECTS:** user can view; user cannot approve (403); maintainer lifecycle transitions audited; milestone progress counts verified actions.
- **AGENTS:** disabled agent runs nothing; agent endpoints require human principal; recommendations land as PENDING + audited; no path from agent output to state mutation.
- **PASSPORT:** counts match ledger/impact_events; no address fields in public profile responses.

## 14. Phased Implementation Plan (strict order, verified after each)

| Phase | Deliverable | Verify |
|---|---|---|
| 0 ✅ | This audit + roadmap | done |
| 1 | Geo hierarchy + clusters + spatial queries + map v1 + geo APIs + seed | typecheck, all tests, new geo/map tests, migration against fresh DB |
| 2 | Impact Passport + public profile + privacy filters | new passport tests |
| 3 | QR registry + scan engine + anti-abuse + scanner screen + mission integration | QR tests |
| 4 | **EcoPoints debits + full Rewards system + claim/fulfillment + rewards UI** | rewards + concurrency tests |
| 5 | Map + cluster detail intelligence + metrics history | map tests |
| 6 | Milestones (count-based) + community projects + governance | project tests |
| 7 | Agent configs + permission boundaries + worker host | agent boundary tests |

After each phase: `pnpm typecheck`, `pnpm --filter @ecopulse/api test`, fresh-DB migration check, document what changed in this file's phase table.

## 15. Known Risks & Decisions Needed

1. **PostGIS unavailable locally** (verified). Plan: GeoJSON + bbox + SQL point-in-polygon now, PostGIS-shaped schema; swap-in later = backfill migration. *Alternative: user installs PostGIS (`brew install postgis`) and we use it directly.*
2. **Map library choice** for Expo (react-native-maps needs dev build for polygons on Android; leaflet-in-webview as fallback). Decide at Phase 1 start.
3. **Queue persistence lib** for offline (AsyncStorage is fine to start; MMKV if perf demands).
4. Role staleness during Phase 1–3 (mitigated in Phase 4 hardening window or pulled forward if user prefers).
