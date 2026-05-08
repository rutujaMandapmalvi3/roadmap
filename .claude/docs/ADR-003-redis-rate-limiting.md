# ADR-003: Redis for Rate Limiting
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
Rate limiting is needed to control OpenAI API costs and prevent abuse. The app runs on ECS — multiple task instances share traffic. Rate limit counters must be consistent across all instances and survive restarts.

## Decision
Use Redis (AWS ElastiCache) as the rate limit store via `ioredis` + `rate-limit-redis`. Keys are per-user (`req.user.userId`), not per-IP.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Redis + per-userId key (chosen) | Atomic INCR/EXPIRE, shared across instances, survives restart, not bypassable via VPN | Extra infrastructure dependency | — chosen |
| In-memory store (default express-rate-limit) | Zero setup | Resets on restart, not shared across ECS tasks, IP-based = bypassable via VPN | Ineffective in multi-instance ECS deployment |
| MongoDB rate limit store | Reuse existing DB | ~5-10ms per check vs ~0.1ms Redis, no native atomic counter | Too slow — runs on every request |
| Per-IP limiting | Simpler | Bypassable via VPN, unfair on shared IPs (office/NAT) | Security requirement: per-user, not per-IP |

## Consequences
- **Positive**: Atomic counters (no race condition), shared across all ECS tasks, auto-expiry after window ends, per-user = VPN-proof
- **Negative**: Additional infrastructure (ElastiCache), graceful fallback to IP if userId missing (with warning log)
- **Risks**: Redis connection failure — falls back to IP-based limiting with warning. Does not block requests on Redis failure (fail-open by design).

## Rationale
Rate limit check runs on every request — must be sub-millisecond. Redis atomic `INCR` + `EXPIRE` is the industry standard for distributed rate limiting. Per-user keying on verified JWT userId cannot be bypassed by changing networks.
