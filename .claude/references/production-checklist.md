# Production Checklist — myMap Backend

> Apply to every PR before merge. No exceptions.

---

## Input Validation
- [ ] All `req.body` fields validated with Zod schema before hitting OpenAI or DB
- [ ] All `req.params.id` values are valid MongoDB ObjectId strings before `findById`
- [ ] String fields have both min AND max length constraints
- [ ] Enum fields use `z.enum([...])` — no free-form strings for controlled values
- [ ] OpenAI output validated with Zod before saving to DB
- [ ] Validation failure → 400, OpenAI never called

## Authentication + Authorization
- [ ] `authMiddleware` applied to every route in `index.js` (except `/health`)
- [ ] `userId` always from `req.user.userId` — never from `req.body`, `req.params`, or `req.query`
- [ ] Ownership check on every route accessing a document by ID:
  `if (!doc || doc.userId !== req.user.userId) return res.status(404).json(...)`
- [ ] 404 (not 403) returned for ownership failures — prevents resource enumeration

## Rate Limiting
- [ ] `chatLimiter` applied before `POST /chat` handler
- [ ] `conversationsLimiter` applied before `GET /conversations` handler
- [ ] `/health` excluded from rate limiting
- [ ] Redis store configured — not in-memory default

## Error Handling
- [ ] Every `catch` block logs full error server-side (`console.error`)
- [ ] Every `catch` block returns generic message to client — never `error.message`
- [ ] No stack traces in HTTP responses
- [ ] No DB error details in HTTP responses
- [ ] OpenAI errors handled: 429, timeout, generic failure — all surfaced as clean messages

## No Debug Code
- [ ] No `console.log(req.body)` anywhere in routes
- [ ] No `console.log(token)` or logging of auth headers
- [ ] No hardcoded test IDs or development-only values in production code paths
- [ ] No commented-out code blocks

## MongoDB
- [ ] `Conversation.create()` uses `req.user.userId` for `userId` field — never from body
- [ ] Follow-up appends to `messages` array — does not replace it
- [ ] `roadmap` field overwrites on follow-up — does not append
- [ ] List endpoint selects only `_id topic createdAt updatedAt` — never sends full messages in list response

## OpenAI Wrapper
- [ ] All AI calls go through `services/openai.js:generateRoadmap()` — never direct SDK call in routes
- [ ] `response_format: { type: 'json_object' }` set on all OpenAI calls
- [ ] 30s timeout configured on OpenAI client

## Environment + Secrets
- [ ] No secrets hardcoded in source
- [ ] No `process.env.X || "hardcoded-fallback"` for production secrets
- [ ] `.env` in `.gitignore` — verify: `git check-ignore -v .env`
- [ ] All required env vars documented in CLAUDE.md

## Tests
- [ ] Unit tests cover all branches in changed files
- [ ] Negative cases covered: invalid input, not found, ownership failure, DB error, OpenAI error
- [ ] New routes have integration tests verifying ownership enforcement
- [ ] `npm test` passes with no failures

## Traceability
- [ ] Every new function has `// FR-NNN:` comment
- [ ] Every new test has `// Validates FR-NNN, AC-NNN` comment
- [ ] Traceability matrix updated in `.claude/docs/traceability.md`
