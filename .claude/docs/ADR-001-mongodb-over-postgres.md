# ADR-001: MongoDB over PostgreSQL
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
The roadmap data structure is a nested JSON object (phases → milestones → resources). Its shape may evolve as features are added. A conversation document is always loaded atomically — no joins needed. The system is cloud-hosted with managed infrastructure preferred.

## Decision
Use MongoDB Atlas (cloud-managed) as the primary database.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| MongoDB Atlas (chosen) | Flexible JSON schema, atomic document load, managed ops | No ACID across documents, no relational queries | — chosen |
| PostgreSQL (RDS) | ACID transactions, relational queries, mature | Requires schema migration for roadmap shape changes, overkill for document model | Roadmap is JSON — no relational benefit |
| DynamoDB | Serverless, infinite scale | Complex query patterns, no aggregation, hard to iterate | Premature optimization, worse DX |

## Consequences
- **Positive**: Variable roadmap JSON shape fits naturally, no ORM friction, Atlas handles backups/scaling/indexes
- **Negative**: No ACID transactions across documents (not needed here), no complex relational queries
- **Risks**: Schema drift if roadmap shape evolves without Zod validation — mitigated by Zod output validation on every OpenAI response

## Rationale
Conversation is one document, loaded atomically. Roadmap is variable JSON. No joins anywhere in the data model. MongoDB is the natural fit.
