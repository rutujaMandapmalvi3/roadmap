const mongoose = require('mongoose');

  const messageSchema = new mongoose.Schema({                                                                                                 
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true }                                                                                                 
  }, { _id: false, timestamps: true });

  const conversationSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },                                                                                    
    messages: [messageSchema],                                                                                                                
    roadmap: { type: mongoose.Schema.Types.Mixed, default: null }
  }, { timestamps: true });

  module.exports = mongoose.model('Conversation', conversationSchema);