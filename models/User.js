const mongoose = require('mongoose');

// Cognito manages passwords and login — this model just stores the user's identity in MongoDB
// so we can link conversations and other data to a real user record
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Cognito sub (UUID) — never changes even if email does
  email:  { type: String, required: true }
}, { timestamps: true }); // timestamps adds createdAt and updatedAt automatically

module.exports = mongoose.model('User', userSchema);
