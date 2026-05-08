# ADR-004: Per-Route Rate Limits (not global)
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
Not all routes have the same cost. `POST /chat` calls OpenAI (costs money, ~2-5s latency). `GET /conversations` is a lightweight DB read (~5ms). A single global limit either over-restricts cheap routes or under-protects expensive ones.

## Decision
Separate rate limiters per route, each with an appropriate quota:
- `POST /chat`: 10 req / 15 min per user
- `GET /conversations`: 100 req / 15 min per user

Both limits configurable via environment variables.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Per-route limits (chosen) | Right-sized per cost, configurable, independent | Slightly more setup | — chosen |
| Single global limit | Simple | Over-restricts cheap routes OR under-protects expensive routes | Blunt instrument — wrong tradeoff |
| Per-method limit (GET vs POST) | Simpler than per-route | GET /health and GET /conversations have very different costs | Not granular enough |

## Consequences
- **Positive**: OpenAI cost protected with tight limit, cheap reads get generous quota, both limits tunable via env vars without code change
- **Negative**: Two limiters to maintain, limit values need review as traffic grows
- **Risks**: 10 req/15min may be too restrictive for power users — monitor and adjust via CHAT_RATE_LIMIT_MAX env var

## Rationale
`POST /chat` is the only expensive endpoint (OpenAI cost). `GET /conversations` is a page-load call. Same limit for both would degrade UX on reads for no benefit.
