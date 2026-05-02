const express = require('express');
const router = express.Router(); // mini Express app just for /chat routes
const { z } = require('zod'); // validation library — checks input/output shape at runtime

const { generateRoadmap } = require('../services/openai'); // OpenAI wrapper — handles API call + error handling
const Conversation = require('../models/Conversation'); // Mongoose model — maps to conversations collection

// defines what valid input looks like for a fresh conversation — rejects bad data before it hits OpenAI
const freshChatSchema = z.object({
    topic: z.string().min(2),
    currentLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    timeframe: z.string().min(1),
    goal: z.string().min(3)
});

// defines what valid input looks like for a follow-up — different fields than fresh start
const followUpSchema = z.object({
    conversationId: z.string().min(1),  // MongoDB _id of the existing conversation
    followUpMessage: z.string().min(1)  // the user's follow-up question
});

// defines the shape we expect back from OpenAI — validates output before saving to MongoDB
const roadmapSchema = z.object({
    phases: z.array(z.object({
        title: z.string(),
        duration: z.string(),
        milestones: z.array(z.object({
            title: z.string(),
            resources: z.array(z.string()) // array of resource links/names
        }))
    }))
});


// POST / — handles both fresh roadmap generation and follow-up refinements
router.post('/', async (req, res) => {
    console.log('body:', req.body);

    const isFollowUp = !!req.body.conversationId; // true if conversationId exists in body, false if not

    // pick the right schema — follow-up needs conversationId+message, fresh needs topic/level/etc
    const validation = isFollowUp
        ? followUpSchema.safeParse(req.body)    // validate follow-up fields
        : freshChatSchema.safeParse(req.body);  // validate fresh start fields

    if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors }); // 400 = Bad Request — reject before hitting OpenAI
    }

    try {
        // destructure all possible fields — not all will exist depending on fresh vs follow-up
        const { topic, currentLevel, timeframe, goal, conversationId, followUpMessage } = req.body;
        const userId = req.user.userId;

        let messages; // will hold the message array sent to OpenAI
        let existingConvo = null; // will hold the MongoDB doc if this is a follow-up

        if (conversationId) {
            // follow-up — fetch existing conversation from MongoDB
            existingConvo = await Conversation.findById(conversationId);
            if (!existingConvo) return res.status(404).json({ error: 'Conversation not found' });

            const history = existingConvo.messages.slice(-10); // sliding window — last 10 messages only, keeps token cost low
            messages = [...history, { role: 'user', content: followUpMessage }]; // append new message to history
        } else {
            // fresh start — build messages array from scratch with system prompt + user input
            messages = [
                { role: 'system', content: 'You are an expert learning coach. Return a JSON object with this exact structure: { "phases": [{ "title": string, "duration": string, "milestones": [{ "title": string, "resources": [string] }] }] }' },
                { role: 'user', content: `Topic: ${topic}. Current level: ${currentLevel}. Timeframe: ${timeframe}. Goal: ${goal}.` }
            ];
        }

        const roadmap = await generateRoadmap(messages); // call OpenAI — returns raw JSON string
        const parsedRoadmap = JSON.parse(roadmap); // convert string → JS object so Zod can validate it

        const roadmapValidation = roadmapSchema.safeParse(parsedRoadmap); // validate OpenAI output matches expected shape
        if (!roadmapValidation.success) {
            return res.status(500).json({ error: 'OpenAI returned an unexpected structure. Please try again.' });
        }

        if (existingConvo) {
            // follow-up — push new messages to history and overwrite roadmap with updated version
            existingConvo.messages.push({ role: 'user', content: followUpMessage });
            existingConvo.messages.push({ role: 'assistant', content: roadmap });
            existingConvo.roadmap = JSON.parse(roadmap); // replace roadmap with latest version
            await existingConvo.save(); // markModified not needed — Mongoose detects top-level field replacement
            res.json(existingConvo); // send back updated conversation
        } else {
            // fresh start — create new conversation document in MongoDB
            const convo = await Conversation.create({ userId, messages, roadmap: JSON.parse(roadmap) });
            res.status(201).json(convo); // 201 = Created — sends back the new conversation object including _id and roadmap
        }

    } catch (error) {
        res.status(500).json({ error: error.message }); // catch-all — includes OpenAI errors forwarded from openai.js
    }
});

module.exports = router; // export so index.js can mount this at /chat