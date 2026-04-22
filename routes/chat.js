const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { generateRoadmap } = require('../services/openai'); // OpenAI wrapper
const Conversation = require('../models/Conversation'); // Mongoose model

// defines what valid input looks like for a fresh conversation                                                                             
const freshChatSchema = z.object({
    userId: z.string().min(1),          // must be a non-empty string                                                                         
    topic: z.string().min(2),           // at least 2 chars — catches gibberish like "a"                                                      
    currentLevel: z.enum(['beginner', 'intermediate', 'advanced']),  // only these 3 values allowed                                           
    timeframe: z.string().min(1),
    goal: z.string().min(10)            // at least 10 chars — forces a real goal, not "idk"                                                  
});

// defines what valid input looks like for a follow-up                                                                                      
const followUpSchema = z.object({
    conversationId: z.string().min(1),
    followUpMessage: z.string().min(1)
});

const roadmapSchema = z.object({
    phases: z.array(z.object({
        title: z.string(),
        duration: z.string(),
        milestones: z.array(z.object({
            title: z.string(),
            resources: z.array(z.string())
        }))
    }))
});


router.post('/', async (req, res) => {

    const isFollowUp = !!req.body.conversationId; // true if conversationId exists, false if not                                                

    const validation = isFollowUp
        ? followUpSchema.safeParse(req.body)    // validate follow-up fields                                                                      
        : freshChatSchema.safeParse(req.body);  // validate fresh start fields                                                                    

    if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors }); // reject bad input immediately                                          
    }
    try {
        const { userId, topic, currentLevel, timeframe, goal, conversationId, followUpMessage } = req.body; // added conversationId +followUpMessage for history

        let messages;
        let existingConvo = null;

        if (conversationId) {
            // follow-up message — fetch existing conversation
            existingConvo = await Conversation.findById(conversationId); // get the full conversation from MongoDB
            if (!existingConvo) return res.status(404).json({ error: 'Conversation not found' });

            const history = existingConvo.messages.slice(-10); // sliding window — last 10 messages only, avoids token limit
            messages = [...history, { role: 'user', content: followUpMessage }]; // append new message to history
        } else {
            // fresh start — no history
            messages = [
                {role: 'system', content: 'You are an expert learning coach. Return a JSON object with this exact structure: { "phases": [{ "title": string, "duration": string, "milestones": [{ "title": string, "resources": [string] }] }] }'},
                
                { role: 'user', content: `Topic: ${topic}. Current level: ${currentLevel}. Timeframe: ${timeframe}. Goal: ${goal}.` }
            ];
        }

        const roadmap = await generateRoadmap(messages); // call OpenAI
          const parsedRoadmap = JSON.parse(roadmap); // convert string to JS object                                                                   
                                                                                                                                              
  const roadmapValidation = roadmapSchema.safeParse(parsedRoadmap); // check it matches expected shape                                        
  if (!roadmapValidation.success) {                                                                                                           
    return res.status(500).json({ error: 'OpenAI returned an unexpected structure. Please try again.' });                                     
  } 

        if (existingConvo) {
            // update existing conversation — push new message + update roadmap
            existingConvo.messages.push({ role: 'user', content: followUpMessage });
            existingConvo.messages.push({ role: 'assistant', content: roadmap });
            existingConvo.roadmap = JSON.parse(roadmap);
            await existingConvo.save(); // markModified not needed — mongoose detects top-level field changes
            res.json(existingConvo);
        } else {
            // create new conversation
            const convo = await Conversation.create({ userId, messages, roadmap: JSON.parse(roadmap) });
            res.status(201).json(convo);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;