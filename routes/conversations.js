const express = require('express');
const Conversation = require('../models/Conversation');
const router = express.Router();

router.post('/', async (req, res) => {
    try{
        const { userId, messages, roadmap } = req.body;
        const convo = await Conversation.create({ userId, messages, roadmap });
        res.status(201).json(convo);
    } catch(error){
        console.error("Error creating conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

router.get('/:id', async(req, res) => {
    try{
        const convo = await Conversation.findById(req.params.id);
        if(!convo){return res.status(404).json({error: "not found"})}
        res.json(convo);

    } catch(error){
        console.error("Error fetching conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

router.post('/:id/messages', async(req, res) => {
    try{
        const{role, content} = req.body;
        const convo = await Conversation.findByIdAndUpdate(
            req.params.id,
            {$push: {messages: {role, content}}},
            {new: true}
        );
        if(!convo){return res.status(404).json({error: "not found"})}
        res.json(convo);
    } catch(error){
        console.error("Error adding message to conversation:", error);
        res.status(500).json({error: "Internal Server Error"});
    }
});

module.exports = router;