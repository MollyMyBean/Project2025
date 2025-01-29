// server/models/DiscoverAdmin.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * We store which "admin" is discoverable and
 * an array of photo URLs that appear on Discover.
 */
const discoverAdminSchema = new Schema({
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Additional photos for the “swipe” experience
  photos: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('DiscoverAdmin', discoverAdminSchema);
