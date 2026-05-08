# API Contracts — myMap Backend

> Source of truth for all backend endpoints. Frontend must match these exactly.
> Changes here require a version bump if breaking.

---

## Authentication

All endpoints except `/health` require:
```
Authorization: Bearer <Cognito ID Token>
```
Missing or invalid token → `401 { "error": "No token provided" }` or `401 { "error": "Invalid or expired token" }`

---

## POST /chat

Generates a new roadmap or refines an existing one.

### Fresh conversation

**Request:**
```json
{
  "topic": "string (2-200 chars, required)",
  "currentLevel": "beginner | intermediate | advanced (required)",
  "timeframe": "string (1-100 chars, required)",
  "goal": "string (1-500 chars, required)"
}
```

**Response 201:**
```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "userId": "us-east-1:abc-123",
  "topic": "React",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Topic: React. Level: beginner..." },
    { "role": "assistant", "content": "{...}" }
  ],
  "roadmap": {
    "phases": [
      {
        "title": "Foundations",
        "duration": "2 weeks",
        "milestones": [
          { "title": "JSX basics", "resources": ["reactjs.org/docs"] }
        ]
      }
    ]
  },
  "createdAt": "2026-05-08T10:00:00.000Z",
  "updatedAt": "2026-05-08T10:00:00.000Z"
}
```

### Follow-up

**Request:**
```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d1 (valid MongoDB ObjectId, required)",
  "followUpMessage": "string (1-1000 chars, required)"
}
```

**Response 200:** Same shape as fresh conversation response.

### Errors

| Condition | Status | Body |
|-----------|--------|------|
| Missing required field | 400 | `{ "error": "field: message" }` |
| topic < 2 chars | 400 | Zod error |
| currentLevel invalid enum | 400 | Zod error |
| conversationId not found | 404 | `{ "error": "Conversation not found" }` |
| conversationId wrong owner | 404 | `{ "error": "Conversation not found" }` |
| OpenAI rate limit | 500 | `{ "error": "OpenAI rate limit hit — try again in a moment" }` |
| OpenAI timeout | 500 | `{ "error": "OpenAI timed out — please try again" }` |
| OpenAI down | 500 | `{ "error": "OpenAI unavailable — please try again" }` |
| OpenAI wrong shape | 500 | `{ "error": "OpenAI returned an unexpected structure. Please try again." }` |
| Rate limit exceeded | 429 | `{ "error": "Too many requests, please try again later." }` |

**Rate limit**: 10 req / 15 min per userId.

---

## GET /conversations

Returns lightweight list of all conversations for the authenticated user.

**Response 200:**
```json
[
  {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "topic": "React",
    "createdAt": "2026-05-08T10:00:00.000Z",
    "updatedAt": "2026-05-08T10:45:00.000Z"
  }
]
```

Note: `messages` and `roadmap` are NOT included. Load via `GET /conversations/:id`.
Sorted: `updatedAt` descending.
Empty list → `[]` (not 404).

**Rate limit**: 100 req / 15 min per userId.

---

## GET /conversations/:id

Returns full conversation document for the authenticated user.

**Response 200:** Full document (same shape as POST /chat response).

**Errors:**

| Condition | Status | Body |
|-----------|--------|------|
| Not found | 404 | `{ "error": "not found" }` |
| Wrong owner | 404 | `{ "error": "not found" }` (same message — no enumeration) |
| DB error | 500 | `{ "error": "Internal Server Error" }` |

---

## GET /health

No auth required. Not rate limited.

**Response 200:**
```json
{ "status": "ok", "db": "connected", "redis": "connected" }
```

Used by ECS health checks and smoke tests.

---

## Error Shape (all routes)

```json
{ "error": "Human readable message. Never exposes stack trace or DB internals." }
```

All errors return this shape. Status code in HTTP header, not in body.
