# ADR-001: Modular Monolith Architecture First

## Status
Accepted

## Context
EcoPulse requires rapid iteration across multiple domains (identity, community management, missions, streaks, points, auditability, and future agent reasoning). Splitting the initial backend into multiple independent microservices introduces distributed transaction overhead, network latency, premature serialization complexity, and high operational toil for a single engineering team.

## Decision
We adopt a **modular monolith** backend built on Node.js, Fastify, and TypeScript. Each domain module encapsulates its own routes, business services, and repositories, communicating internally via typed contracts and an asynchronous Domain Event Bus.

## Consequences
- **Positive**: Single codebase, transactional database integrity, atomic deployments, rapid schema evolutions.
- **Negative**: Requires strict module boundary discipline to prevent leaky abstractions.
- **Mitigation**: Module boundaries are enforced via clean repository and service layers. When scale warrants, any module can be extracted into an independent microservice or serverless worker without rewriting domain logic.
