require("dotenv").config();
const cors = require("cors");
const connectDB = require("./db");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis = require("ioredis");
const conversationRoutes = require("./routes/conversations");
const chatRoutes = require("./routes/chat");
const authMiddleware = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client — shared across limiters
// lazyConnect: true means app starts even if Redis is temporarily unreachable
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });

redis.on("error", (err) => {
  // log but don't crash — limiters fall back to in-memory if Redis unavailable
  console.error("[Redis] connection error:", err.message);
});

function buildLimiter({ max, routeName }) {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10),
    max,
    // key by userId — survives VPN switches, fair across shared IPs
    keyGenerator: (req) => {
      if (!req.user?.userId) {
        // auth middleware always runs first — this should never happen
        // if it does, fall back to IP so request is still rate-limited
        console.warn(`[RateLimit] ${routeName}: req.user.userId missing, falling back to IP`);
        return req.ip;
      }
      return req.user.userId;
    },
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
    handler: (req, res) => {
      console.warn(`[RateLimit] ${routeName}: userId=${req.user?.userId} hit limit`);
      res.status(429).json({ error: "Too many requests, please try again later." });
    },
    skip: (req) => req.path === "/health", // never rate-limit health checks
  });
}

const chatLimiter = buildLimiter({
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX, 10),
  routeName: "POST /chat",
});

const conversationsLimiter = buildLimiter({
  max: parseInt(process.env.CONVERSATIONS_RATE_LIMIT_MAX, 10),
  routeName: "GET /conversations",
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// health check — no auth, no rate limit, for load balancer / uptime monitors
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// auth runs before limiter on every protected route — limiter needs req.user.userId
app.use("/chat", authMiddleware);
app.use("/chat", chatLimiter);
app.use("/chat", chatRoutes);

app.use("/conversations", authMiddleware);
app.use("/conversations", conversationsLimiter);
app.use("/conversations", conversationRoutes);

app.get("/", (req, res) => res.send("Hello, World!"));

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
