// server/models/Video.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const replySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { _id: false });

const commentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  replies: [replySchema]
});

const videoSchema = new Schema({
  title: { type: String, required: true },
  videoUrl: { type: String, required: true },
  isPhoto: { type: Boolean, default: false },
  uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },

  // Likes on the entire video
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  // Comments array
  comments: [commentSchema],

  // Share count (for simulate traffic)
  shareCount: { type: Number, default: 0 },

  // Optional premium/locked logic
  locked: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  unlockers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model('Video', videoSchema);
