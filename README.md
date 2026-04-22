# myMap — Learning Path Planner

AI-powered app that generates personalized visual learning roadmaps based on user input. Built with Node.js, Express, MongoDB, and OpenAI.

---

## Pipeline

```
User opens app
    ->  Authentication — Cognito verifies JWT token on every request. No valid token = request rejected before hitting any route.

User fills form (what to learn, current level, timeframe, goal)
    ->  Request hits the server
    ->  Rate limiting — max N requests per user per minute. Prevents abuse and protects OpenAI API costs.
    ->  Input validation — all required fields must be present and non-empty. Rejected early if missing.

Server builds context
    ->  New conversation: system prompt (AI personality) + user form input sent to OpenAI
    ->  Returning user: full conversation history fetched from MongoDB
            ->  Sliding window applied — only last 10 messages sent to OpenAI (keeps token usage low, controls cost)
            ->  New message appended to history as context

OpenAI generates roadmap
    ->  Forced JSON output — structured response every time, no free-form text that could break the app
    ->  Accuracy — system prompt instructs AI to return phases, milestones, and resources in a consistent schema
    ->  Rate limit handling — if OpenAI throttles the request, user gets a friendly "try again" message instead of a crash
    ->  Fallback — if OpenAI is down, error is caught and surfaced cleanly to the user

Roadmap saved to database
    ->  New conversation: stored with userId, full message history, and roadmap
    ->  Existing conversation: history updated, roadmap replaced with latest version
    ->  Timestamps auto-recorded on every save

Response returned to frontend
    ->  Full conversation document returned including roadmap JSON
    ->  Frontend renders roadmap visually using React Flow (nodes, edges, phases, milestones)
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
- `conversationId` *(optional)* — if following up on an existing roadmap
- `followUpMessage` *(optional)* — the follow-up message if refining the roadmap

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

```
myMap/
├── index.js              # Entry point — Express app, middleware, route mounting
├── db.js                 # MongoDB connection via Mongoose
├── .env                  # Secrets (MONGODB_URI, OPENAI_API_KEY) — never committed
├── .gitignore
├── package.json
├── models/
│   └── Conversation.js   # Mongoose schema: { userId, messages[], roadmap }
├── routes/
│   ├── conversations.js  # CRUD routes for conversations
│   └── chat.js           # Main /chat route — generates roadmap via OpenAI
└── services/
    └── openai.js         # OpenAI wrapper — generateRoadmap(messages)
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
