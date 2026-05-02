// Loads env vars, configures Express with CORS, rate limiting, and JSON parsing,
// applies auth middleware to protected routes, mounts /chat and /conversations routers,
// connects to MongoDB, then starts the HTTP server.
require('dotenv').config();
const cors = require('cors');
const connectDB = require('./db');
const express = require('express');
const app = express();
const rateLimit = require('express-rate-limit');
const conversationRoutes = require('./routes/conversations');
const chatRoutes = require('./routes/chat');
const authMiddleware = require('./middleware/auth');

app.use(cors({
    origin: 'http://localhost:3001', // only allow requests from Next.js dev server                                                           
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'] // allow JWT token header                                                               
}));

const PORT = 3000;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 * 60 * 1000 = 900,000 milliseconds = 15 minutes
    max: 50,                   // 50 requests per IP per window
    message: { error: 'Too many requests, please try again later.' }
});

app.use(express.json()); //middleware to parse JSON bodies
app.use(limiter);
app.use('/chat', authMiddleware);           // protect chat
app.use('/conversations', authMiddleware); // protect conversations
app.use('/conversations', conversationRoutes); //mount the conversation routes
app.use('/chat', chatRoutes); //mount the chat routes

connectDB();

app.get('/', (req, res) => {
    res.send("Hello, World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});