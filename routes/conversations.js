// CRUD routes for conversations.
// POST /            → create a new conversation
// GET /:id          → fetch a conversation by ID
// POST /:id/messages → append a message to an existing conversation
const express = require('express');
const Conversation = require('../models/Conversation'); // Mongoose model — maps to conversations collection in MongoDB
const router = express.Router(); // creates a mini Express app just for these routes

// POST / — creates a brand new conversation and saves it to MongoDB
router.post('/', async (req, res) => {
    try{
        const { userId, messages, roadmap } = req.body; // pull fields from request body
        const convo = await Conversation.create({ userId, messages, roadmap }); // insert new document into MongoDB
        res.status(201).json(convo); // 201 = Created, send back the saved conversation
    } catch(error){
        console.error("Error creating conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

// GET /:id — fetches a single conversation by its MongoDB _id
router.get('/:id', async(req, res) => {
    try{
        const convo = await Conversation.findById(req.params.id); // req.params.id = the :id from the URL
        if(!convo){return res.status(404).json({error: "not found"})} // 404 if no match
        res.json(convo); // send back the full conversation object

    } catch(error){
        console.error("Error fetching conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

// POST /:id/messages — appends a new message to an existing conversation's messages array
router.post('/:id/messages', async(req, res) => {
    try{
        const{role, content} = req.body; // role = 'user' or 'assistant', content = the message text
        const convo = await Conversation.findByIdAndUpdate(
            req.params.id,
            {$push: {messages: {role, content}}}, // $push appends to the array without replacing it
            {new: true} // return the updated document, not the old one
        );
        if(!convo){return res.status(404).json({error: "not found"})}
        res.json(convo); // send back the updated conversation
    } catch(error){
        console.error("Error adding message to conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

module.exports = router; // export so index.js can mount these routes