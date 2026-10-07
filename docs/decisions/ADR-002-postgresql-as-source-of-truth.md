# ADR-002: PostgreSQL as Authoritative Source of Truth

## Status
Accepted

## Context
Environmental records, community boundaries, citizen rewards, and audit trails demand ACID compliance, relational integrity, geospatial queries (PostGIS), and strict schema validation. Document stores or loose NoSQL databases make transactional point accounting and relational audits difficult to enforce reliably.

## Decision
We select **PostgreSQL** with **Drizzle ORM** as the authoritative primary store for all state.

## Consequences
- **Positive**: Strict foreign keys, native JSONB support for polymorphic metadata and GeoJSON boundaries, transactional atomicity, robust indexing, and seamless transition to AWS RDS Aurora.
- **Negative**: Database connection pooling must be managed carefully in high-concurrency environments.
- **Mitigation**: Managed connection pooling configured with `pg.Pool` with sane connection limits and health checks.
