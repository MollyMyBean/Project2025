// server/models/SuggestedAdmin.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Stores references to the ADMIN users that "admin1@example.com" has chosen
 * to appear in the "Suggested Creators" section for all users.
 */
const suggestedAdminSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('SuggestedAdmin', suggestedAdminSchema);
