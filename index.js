require('dotenv').config();
const connectDB = require('./db');
const express = require('express');
const app = express();
const conversationRoutes = require('./routes/conversations');
const chatRoutes = require('./routes/chat');
const authMiddleware = require('./middleware/auth');
app.use('/chat', authMiddleware);           // protect chat
app.use('/conversations', authMiddleware); // protect conversations 


app.use(express.json()); //middleware to parse JSON bodies
app.use('/conversations', conversationRoutes); //mount the conversation routes
app.use('/chat', chatRoutes); //mount the chat routes
const PORT = 3000;


connectDB();

app.get('/', (req, res) => {
    res.send("Hello, World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});