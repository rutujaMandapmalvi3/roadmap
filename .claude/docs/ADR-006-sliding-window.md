# ADR-006: Sliding Window for OpenAI Context (Last 10 Messages)
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
Conversation history grows unboundedly as users refine their roadmap. Sending the full history to OpenAI on every follow-up would eventually hit the context window limit (128k tokens for gpt-4o) and increases per-request cost linearly with conversation length.

## Decision
Store full message history in MongoDB (unbounded). Send only the last 10 messages to OpenAI on follow-up requests using `.slice(-10)`.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| Last 10 messages (chosen) | Bounded token cost, sufficient context for refinements, full history in DB | Very old context lost from model view | — chosen |
| Full history | Model has complete context | Hits token limit as conversations grow, cost grows linearly | Unsustainable at scale |
| Summarization | Compressed long-term memory | Complex to implement, requires extra OpenAI call for summary | Over-engineered for current scale |
| Last N (configurable) | Flexible | Added complexity with no immediate need | Implement when N=10 proves insufficient |

## Consequences
- **Positive**: Token cost is bounded regardless of conversation length, full history preserved in MongoDB for future features (search, export)
- **Negative**: Context older than 10 messages not visible to model during refinement
- **Risks**: User may reference something from 15 messages ago — model won't have it. Acceptable tradeoff for current use case (roadmap refinement, not long-form dialogue).

## Rationale
10 messages covers ~5 back-and-forth exchanges — enough context for any reasonable roadmap refinement session. Full history in MongoDB preserves optionality for future features without any cost.
