# ADR-004: AI Recommendations Require Human Accountability

## Status
Accepted

## Context
Future iterations of EcoPulse will incorporate computer vision for waste detection, drone imagery analysis, automated mission verification, and automated municipal task dispatches. Autonomous AI agents making consequential decisions (such as fining residents, penalizing communities, or dispatching expensive municipal equipment) without supervision introduces severe liability, hallucination risk, and public distrust.

## Decision
We enforce the core architectural constraint:
**"AI recommends actions. Humans approve consequential actions."**

All AI agent outputs are stored in `agent_actions` with `requires_human_approval = true` and `approval_status = 'PENDING'`. An authenticated human Maintainer or Ward Admin must review and approve consequential actions before state mutations take effect.

## Consequences
- **Positive**: Verifiable safety, regulatory compliance, prevention of automated abuse.
- **Negative**: Adds a human review step for high-impact events.
- **Mitigation**: Low-consequence events (e.g. standard daily cleanliness missions with low point rewards) can define clear automatic approval thresholds while maintaining audit trails.
