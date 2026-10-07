# ADR-006: Community Intelligence & Reporting Verification Architecture

## Status
Accepted

## Context
EcoPulse is transitioning from technical foundation to real product capabilities. Communities cannot be represented by a single arbitrary scalar score. In addition, citizen reports must go through a verifiable human-in-the-loop lifecycle before points are awarded, ensuring auditability and avoiding fraudulent claims.

## Decisions

### 1. Multidimensional Community State Model
Instead of a single arbitrary number, Community Health is partitioned into 4 distinct, observable dimensions:
1. **BEHAVIOUR (25%)**: Ratio of verified vs rejected citizen reports, mission completion fidelity, and streak maintenance.
2. **PARTICIPATION (25%)**: Ratio of active community members participating in missions and reporting relative to ward size.
3. **SERVICE QUALITY (25%)**: Municipal and maintainer response velocity, field task resolution rate, and verified cleanup ratio.
4. **ENVIRONMENTAL OUTCOME (25%)**: Remediated hazard locations and cumulative verified physical cleanups.

Weights are configurable via `CommunityStateService.setWeights(...)` allowing the scoring methodology to evolve.

### 2. Backend-Owned Report Lifecycle
The backend strictly owns report lifecycle transitions:
`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `VERIFIED` / `REJECTED` → `RESOLVED` → `CLOSED`
Clients cannot arbitrarily flip states.

### 3. Evidence Storage Abstraction
An `IEvidenceStorage` interface decouple media persistence from providers:
- `LocalEvidenceStorage`: Local filesystem storage in development.
- `S3EvidenceStorage`: Plug-in S3 implementation for production.

### 4. Human Verification & Immutable Point Ledger Integration
- Reports in `SUBMITTED` or `UNDER_REVIEW` status are approved/rejected by maintainers via the `HumanReview` abstraction.
- On maintainer approval:
  - Report status transitions to `VERIFIED`.
  - Evidence status transitions to `VERIFIED`.
  - `PointsService.awardPoints` creates an authoritative transaction in `point_ledger` with `source: 'VERIFIED_REPORT'`.
  - Idempotency is enforced by unique index on `(userId, source, referenceId)` and `client_event_id`, strictly preventing duplicate point grants.
- On maintainer rejection:
  - Report transitions to `REJECTED` without any ledger credit.

### 5. Derived Community Activity Timeline
Rather than maintaining a separate denormalized table with drift risks, the unified community timeline is dynamically derived on-the-fly from actual domain events (`audit_logs`, `reports`, `tasks`, and `community_milestones`).

## Consequences
- Clean closed-loop flow: Resident Report → Evidence → Human Review → Verification → Field Task → Verified Outcome → Community State → Milestone.
- Guarantees backward compatibility with all foundation tests.
- Transparent and auditable for citizens and municipal operators.
