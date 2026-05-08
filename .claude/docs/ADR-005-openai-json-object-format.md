# ADR-005: OpenAI response_format: json_object
**Date**: 2026-05-01
**Status**: accepted
**Deciders**: Rutuja Mandapmalvi

## Context
OpenAI by default returns free-form text. If the model returns malformed JSON, `JSON.parse()` throws and the request crashes. In production, this would return a 500 to the user and lose their roadmap generation attempt.

## Decision
Set `response_format: { type: 'json_object' }` on every OpenAI API call. Instruct the model to return JSON in the system prompt.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| response_format: json_object (chosen) | Guaranteed valid JSON, never crashes JSON.parse | Requires explicit JSON instruction in system prompt | — chosen |
| Free-form text + regex extraction | Flexible | Brittle — regex breaks on any format variation, not prod safe | Too fragile |
| response_format: json_schema | Even stronger guarantee — validates shape at API level | Not available on all gpt-4o API versions at time of decision | Upgrade path when available |

## Consequences
- **Positive**: `JSON.parse()` never throws on OpenAI response, eliminates entire class of production crash
- **Negative**: Must include JSON instruction in system prompt (minor), slightly more verbose system prompt
- **Risks**: Model may still return valid JSON with wrong shape — mitigated by Zod output validation after parse

## Rationale
`json_object` mode + Zod output validation creates two layers of defense: OpenAI guarantees valid JSON, Zod guarantees correct shape. Without this, a single malformed response crashes the user's roadmap generation with no recovery.
