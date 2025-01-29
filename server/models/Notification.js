// server/models/Notification.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['message', 'comment', 'like'], required: true },
  text: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },

  // optional references so you know who/what triggered this notification
  fromUser: { type: Schema.Types.ObjectId, ref: 'User' },
  video: { type: Schema.Types.ObjectId, ref: 'Video' },
  message: { type: Schema.Types.ObjectId, ref: 'Message' },
  comment: { type: Schema.Types.ObjectId } // if you want comment ID
});

module.exports = mongoose.model('Notification', notificationSchema);
