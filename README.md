# myMap — Learning Path Planner

AI-powered app that generates personalized visual learning roadmaps based on user input. Built with Node.js, Express, MongoDB, and OpenAI.

---

## Pipeline

```
User opens app
    ->  Authentication — JWT token sent in every request header (Authorization: Bearer <token>)
            ->  authMiddleware verifies token signature + expiry using JWT_SECRET
            ->  Invalid or missing token = 401 rejected before hitting any route
            ->  Valid token = user info attached to req.user, request continues

User fills form (what to learn, current level, timeframe, goal)
    ->  Request hits the server
    ->  Rate limiting — 50 requests per IP per 15 min window. Exceeded = 429, request blocked. Protects OpenAI costs + prevents abuse.
    ->  Input validation (Zod) — all fields checked for type, length, and allowed values before any processing. Bad input = 400 rejected immediately. OpenAI never called.

Server builds context
    ->  New conversation: system prompt (AI personality + exact JSON schema) + user form input sent to OpenAI
    ->  Returning user: full conversation history fetched from MongoDB
            ->  Sliding window — only last 10 messages sent to OpenAI (controls token usage + cost)
            ->  New follow-up message appended to sliced history

OpenAI generates roadmap
    ->  Forced structured JSON output — response_format: json_object guarantees valid JSON every time
    ->  Output validation (Zod) — response checked against expected schema (phases, milestones, resources) before saving. Wrong shape = 500 + retry prompt to user.
    ->  Rate limit handling — OpenAI 429 returns friendly "slow down" message instead of crash
    ->  Fallback — any other OpenAI error caught and surfaced cleanly

Roadmap saved to database (MongoDB Atlas)
    ->  New conversation: userId + full message history + roadmap stored as new document
    ->  Existing conversation: messages array updated, roadmap replaced with latest version, timestamps updated
    ->  Nothing malformed ever reaches the database — input + output both validated before save

Response returned to frontend
    ->  Full conversation document returned (includes _id, messages, roadmap JSON, timestamps)
    ->  Frontend renders roadmap visually using React Flow (phases as nodes, milestones as edges)
    ->  User can refine — follow-up messages loop back into the pipeline with conversation history as context
```

---

## Detailed Flow

### 1. User hits `POST /chat`

The frontend sends a JSON body with the user's form input:

- `userId` — who is making the request
- `topic` — what they want to learn
- `currentLevel` — where they are now (beginner/intermediate/advanced)
- `timeframe` — how long they have
- `goal` — what they want to achieve
- `conversationId` _(optional)_ — if following up on an existing roadmap
- `followUpMessage` _(optional)_ — the follow-up message if refining the roadmap

### 2. History check

The route checks if `conversationId` was passed in the body.

**If yes (follow-up):**

- Fetches the full conversation from MongoDB using `Conversation.findById(conversationId)`
- Takes only the last 10 messages using `.slice(-10)` — this is the **sliding window**. Sending the full history would hit OpenAI's token limit and cost more. 10 messages gives enough context.
- Appends the new follow-up message to that history

**If no (fresh start):**

- Builds a fresh messages array with two entries:
  - `system` — tells OpenAI to behave as a learning coach and return JSON
  - `user` — the form input formatted into a prompt

### 3. OpenAI call

`generateRoadmap(messages)` is called from `services/openai.js`.

Inside the wrapper:

- Creates a request to `gpt-4o` with the messages array
- `response_format: { type: 'json_object' }` forces OpenAI to return valid JSON every time (no malformed responses in prod)
- If OpenAI returns a 429 (rate limit), throws a specific error so the frontend can show "slow down" instead of a generic crash
- Returns `response.choices[0].message.content` — the generated roadmap as a string

### 4. Parse + Save

- `JSON.parse(roadmap)` — OpenAI always returns a string even in JSON mode. This converts it to a real JS object.
- **Existing conversation:** pushes the new user message + assistant reply to `messages`, replaces `roadmap` with the updated version, calls `.save()`
- **New conversation:** calls `Conversation.create()` with userId, messages, and roadmap

### 5. Response

Returns the full conversation document including:

- `_id` — MongoDB auto-generated ID
- `userId`
- `messages` — full history
- `roadmap` — latest JSON roadmap
- `createdAt`, `updatedAt` — auto-added by Mongoose timestamps

---

## Project Structure

### Monorepo (production-grade layout)

```
intprep/                                          ← monorepo root
│
├── .github/
│   ├── workflows/
│   │   ├── ci-backend.yml                        ← lint, test, security, coverage on PR
│   │   ├── ci-frontend.yml                       ← lint, type-check, test, lighthouse on PR
│   │   ├── deploy-backend.yml                    ← backend only → ECS (separate from frontend)
│   │   ├── deploy-frontend.yml                   ← frontend only → CloudFront/ECS
│   │   ├── deploy-backend-rollback.yml           ← emergency rollback to previous SHA
│   │   └── deploy-frontend-rollback.yml
│   ├── CODEOWNERS                                ← enforces who reviews auth, deploy, infra changes
│   ├── pull_request_template.md                  ← PR checklist
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── .claude/                                      ← shared full-stack Claude SDLC skills
│   ├── CLAUDE.md                                 ← monorepo context, full data flow, conventions
│   ├── settings.json
│   ├── docs/
│   │   └── traceability.md                       ← FR → AC → IMPL → TEST → RELEASE matrix
│   └── skills/
│       ├── phase-1-requirements/SKILL.md         ← client ask → FRs + NFRs + ACs
│       ├── phase-2-system-design/SKILL.md        ← FRs → component map, API contracts, data flow
│       ├── phase-3-architecture/SKILL.md         ← design → tech stack, ADRs, infra decisions
│       └── phase-9-traceability-audit/SKILL.md   ← verifies every FR traces to test to release
│
├── .aws/
│   ├── task-definition-backend.json              ← ECS task definition for backend
│   └── task-definition-frontend.json             ← ECS task definition for frontend
│
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── backend.tf                                ← remote state (S3 + DynamoDB lock)
│   └── modules/
│       ├── networking/                           ← VPC, subnets, security groups
│       ├── ecs/                                  ← cluster, services, task definitions
│       ├── ecr/                                  ← container registries
│       ├── cognito/                              ← user pool, app client
│       ├── elasticache/                          ← Redis cluster
│       └── mongodb-atlas/                        ← Atlas cluster via Terraform provider
│
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf                                ← reverse proxy config
│
├── docker-compose.yml                            ← local dev: backend + frontend + MongoDB + Redis
├── docker-compose.test.yml                       ← integration test env: clean state per run
│
├── docs/
│   ├── architecture/
│   │   ├── ADR-001-mongodb-over-postgres.md      ← Architecture Decision Records
│   │   ├── ADR-002-cognito-auth.md
│   │   └── ADR-003-redis-rate-limiting.md
│   ├── api/
│   │   └── openapi.yaml                          ← API contract (OpenAPI spec)
│   └── runbooks/
│       ├── deploy.md
│       ├── rollback.md
│       └── incident-response.md
│
├── scripts/
│   ├── seed-db.js                                ← local dev DB seeding
│   ├── migrate.js                                ← DB migrations
│   └── smoke-test.sh                             ← post-deploy smoke tests, runs after every deploy
│
├── myMap/                                        ← backend (this service)
│   ├── .claude/
│   │   ├── CLAUDE.md                             ← backend-specific rules + constraints
│   │   └── skills/
│   │       ├── phase-4-software-engineer/SKILL.md   ← guides impl, traces FR→code, never writes code
│   │       ├── phase-5-unit-testing/SKILL.md
│   │       ├── phase-6-integration-testing/SKILL.md
│   │       ├── phase-7-security-review/SKILL.md
│   │       ├── phase-8-code-review/SKILL.md
│   │       └── phase-10-release-backend/SKILL.md    ← ECS deploy, canary, rollback
│   ├── src/
│   │   ├── index.js                              ← Express app, middleware, route mounting
│   │   ├── db.js                                 ← MongoDB connection via Mongoose
│   │   ├── middleware/
│   │   │   └── auth.js                           ← Cognito JWT verification
│   │   ├── models/
│   │   │   ├── Conversation.js                   ← schema: { userId, topic, messages[], roadmap }
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── chat.js                           ← POST /chat — new roadmap + follow-ups
│   │   │   └── conversations.js                  ← GET /conversations, GET /conversations/:id
│   │   └── services/
│   │       └── openai.js                         ← OpenAI wrapper — generateRoadmap(messages)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── auth.test.js
│   │   │   ├── chat.test.js
│   │   │   ├── conversations.test.js
│   │   │   └── openai.test.js
│   │   └── integration/
│   │       ├── chat.integration.test.js
│   │       └── conversations.integration.test.js
│   ├── reports/                                  ← coverage.xml, security scan output
│   ├── .env                                      ← secrets — never committed
│   ├── .env.example                              ← placeholders only — committed
│   └── package.json
│
└── mymap-client/                                 ← frontend (separate service, separate deploy)
    ├── .claude/
    │   ├── CLAUDE.md                             ← frontend-specific rules
    │   └── skills/
    │       ├── phase-4-software-engineer/SKILL.md
    │       ├── phase-5-unit-testing/SKILL.md
    │       ├── phase-7-security-review/SKILL.md
    │       ├── phase-8-code-review/SKILL.md
    │       └── phase-10-release-frontend/SKILL.md   ← CloudFront deploy, feature flags, rollback
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                          ← home: roadmap list + create new form
    │   │   ├── login/page.tsx
    │   │   ├── signup/page.tsx
    │   │   └── roadmap/page.tsx                  ← React Flow graph + follow-up form
    │   ├── components/                           ← reusable UI components
    │   ├── lib/
    │   │   ├── api.ts                            ← API client (fetch functions)
    │   │   ├── auth.ts
    │   │   └── useAuth.ts                        ← redirect to /login if no token
    │   └── types/                                ← shared TypeScript types
    ├── tests/
    │   ├── unit/
    │   └── e2e/                                  ← Playwright
    ├── .env.local                                ← secrets — never committed
    ├── .env.example
    ├── next.config.ts
    └── tsconfig.json
```

### Current implementation (this repo)

```
myMap/
├── index.js
├── db.js
├── middleware/auth.js
├── models/
│   ├── Conversation.js
│   └── User.js
├── routes/
│   ├── chat.js
│   └── conversations.js
├── services/openai.js
└── tests/unit/
    ├── auth.test.js
    ├── chat.test.js
    ├── conversations.test.js
    └── openai.test.js
```

---

## Tech Stack

- **Node.js + Express** — backend server
- **MongoDB Atlas** — cloud database (managed, no local setup)
- **Mongoose** — MongoDB ODM, handles schema + validation
- **OpenAI API (gpt-4o)** — generates learning roadmaps as structured JSON
- **dotenv** — loads secrets from `.env` into `process.env`
- **nodemon** — auto-restarts server on file changes (dev only)

---

## API Endpoints

### `POST /chat`

Generates a new learning roadmap or refines an existing one.

**Fresh start body:**

```json
{
  "userId": "user123",
  "topic": "machine learning",
  "currentLevel": "beginner",
  "timeframe": "6 months",
  "goal": "get a job as an ML engineer"
}
```

**Follow-up body:**

```json
{
  "conversationId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "followUpMessage": "Make phase 1 shorter"
}
```

**Response:** Full conversation document with roadmap JSON.

---

### `POST /conversations`

Creates a bare conversation document.

### `GET /conversations/:id`

Fetches a conversation by MongoDB `_id`.

### `POST /conversations/:id/messages`

Appends a message to an existing conversation.

---

## Key Concepts

**Sliding window** — only the last N messages are sent to OpenAI on follow-ups. Prevents hitting token limits and keeps API costs down.

**Mixed type (roadmap field)** — Mongoose `Mixed` stores any JSON shape. Used because the roadmap structure may evolve. Replacing the whole field (not editing inside it) means `markModified()` is not needed.

**Structured output** — `response_format: { type: 'json_object' }` guarantees OpenAI returns valid JSON. Critical in production — malformed responses would crash `JSON.parse()`.

**JWT + Cognito (coming)** — auth middleware will validate Cognito JWT on every request before it hits any route.
