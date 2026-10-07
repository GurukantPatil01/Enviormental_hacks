# ADR-003: Immutable Point Ledger

## Status
Accepted

## Context
In community reward systems, points are economic currency redeemable for municipal perks, tree plantations, or waste reduction rewards. Storing points as a mutable numeric column (`users.points`) makes concurrent updates vulnerable to race conditions, lost updates, and undetectable tampering.

## Decision
We prohibit any mutable `users.points` column. All point transactions are stored in an append-only `point_ledger` table with cryptographic transaction IDs, audit metadata, and unique constraint idempotency.

Current point balances are calculated from the ledger projection:
$$\text{Balance} = \sum_{\text{CREDIT}} \text{amount} - \sum_{\text{DEBIT}} \text{amount}$$

## Consequences
- **Positive**: Complete auditability, reversible adjustments via compensatory credit/debit records, zero race conditions, absolute financial integrity.
- **Negative**: Querying balance requires aggregation if ledger size becomes very large.
- **Mitigation**: Filtered indexing on `(user_id, created_at)` and read-model caching / materialized projection support when transaction volumes surpass millions.
