// models/Tweet.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const tweetSchema = new Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    default: ''
  },
  // Array of user IDs who liked it
  likes: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ],
  // Simple top-level comments
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      content: String,
      // Who liked a comment, if you like
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
  // Add "replies" if you want nested comments
});

module.exports = mongoose.model('Tweet', tweetSchema);
