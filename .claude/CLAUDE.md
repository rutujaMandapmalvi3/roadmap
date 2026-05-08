# myMap Backend — Claude Instructions

## Project Overview
Express.js REST API for an AI-powered learning path generator. Integrates OpenAI GPT-4o for roadmap generation, MongoDB for persistence, AWS Cognito for authentication, and Redis for rate limiting.

## Stack
- **Runtime:** Node.js (CommonJS)
- **Framework:** Express 5
- **Database:** MongoDB via Mongoose
- **Auth:** AWS Cognito — ID tokens (JWT), verified via `aws-jwt-verify`
- **AI:** OpenAI GPT-4o via `services/openai.js` wrapper
- **Rate limiting:** `express-rate-limit` + Redis (`ioredis` + `rate-limit-redis`)
- **Validation:** Zod (input and OpenAI output)

## Project Structure
```
index.js                  — app entry, middleware, route mounting
middleware/auth.js         — Cognito JWT verification, sets req.user.userId
models/Conversation.js    — Mongoose schema (userId, topic, messages, roadmap)
models/User.js            — Mongoose schema (userId, email)
routes/chat.js            — POST /chat (new roadmap + follow-ups)
routes/conversations.js   — GET /, GET /:id, POST /, POST /:id/messages
services/openai.js        — OpenAI wrapper (timeout, error normalization)
db.js                     — MongoDB connection
```

## API Endpoints
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | /chat | JWT | New roadmap or follow-up |
| GET | /conversations | JWT | List all convos for user (lightweight) |
| GET | /conversations/:id | JWT | Full conversation doc |
| GET | /health | None | Health check (no rate limit) |

## Critical Rules

### Auth
- `userId` always extracted from verified JWT (`req.user.userId`) — never from request body
- Auth middleware runs before rate limiter on every protected route
- Ownership check required on all resource access: `existingConvo.userId === req.user.userId`

### Rate Limiting
- Per-user, per-route — keyed by `req.user.userId` (not IP)
- `POST /chat` — 10 req/15min (hits OpenAI, costs money)
- `GET /conversations` — 100 req/15min (cheap DB read)
- Redis store — shared across instances, survives restarts
- Falls back to IP if `req.user.userId` missing (logs warning)

### OpenAI Wrapper (`services/openai.js`)
- Single function: `generateRoadmap(messages)` — accepts any message array, returns raw JSON string
- 30s timeout configured on client
- Three error cases handled: 429 (rate limit), timeout, general failure
- All new AI features must go through this wrapper — never call OpenAI SDK directly in routes

### Validation
- All route inputs validated with Zod before hitting OpenAI or DB
- All OpenAI outputs validated with Zod before saving to DB
- Invalid input → 400. Invalid OpenAI output → 500 with user-friendly message

### MongoDB
- `Conversation.create()` — MongoDB auto-generates `_id` (becomes conversationId)
- Follow-ups: `messages` array appends, `roadmap` field overwrites
- Sliding window: last 10 messages sent to OpenAI (not full history)
- List endpoint selects `_id topic createdAt updatedAt` only — never send full messages over wire for list views

## Environment Variables
```
MONGODB_URI               — MongoDB Atlas connection string
OPENAI_API_KEY            — OpenAI API key (rotate if exposed)
REDIS_URL                 — Redis connection (default: redis://localhost:6379)
CHAT_RATE_LIMIT_MAX       — Max requests to POST /chat per window (default: 10)
CONVERSATIONS_RATE_LIMIT_MAX — Max requests to GET /conversations per window (default: 100)
RATE_LIMIT_WINDOW_MS      — Rate limit window in ms (default: 900000 = 15min)
OPENAI_TIMEOUT_MS         — OpenAI request timeout in ms (default: 30000)
CLIENT_ORIGIN             — Allowed CORS origin (default: http://localhost:3001)
PORT                      — Server port (default: 3000)
```

## Engineering Standards
- Production-grade code only — no shortcuts, no hardcoded values that belong in env
- New routes must: validate input with Zod, check ownership, handle errors explicitly
- Never expose stack traces or raw error objects to the client
- Never call OpenAI SDK directly — always use `services/openai.js`
- Never trust userId from request body — always from `req.user.userId`
- All PRs require: unit tests, integration tests, security review before merge
