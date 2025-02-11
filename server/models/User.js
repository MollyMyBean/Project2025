const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user' // 'user' or 'admin'
  },
  profilePic: {
    type: String
  },
  // NEW field: Admin’s feed banner (for use on ProfilePage, etc.)
  profileBanner: {
    type: String,
    default: ''
  },
  // NEW field: Admin’s banner photo (for suggested creators)
  bannerPic: {
    type: String,
    default: ''
  },
  // NEW field: Banner used on the Profile Preview tab (available for all users)
  previewBanner: {
    type: String,
    default: ''
  },
  purchasedBundles: [
    {
      bundleId: { type: mongoose.Schema.Types.ObjectId },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      title: String,
      price: Number,
      purchasedAt: Date
    }
  ],
  follows: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ],
  subscriptions: [
    {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      validUntil: { type: Date }
    }
  ],
  adminBundles: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
      title: String,
      price: Number,
      description: String,
      // Field for bundle cover image
      coverUrl: {
        type: String,
        default: ''
      }
    }
  ],
  paymentMethod: { type: String, default: '' },
  cardNumber: { type: String },
  cardExp: { type: String },
  cardCVC: { type: String },
  paypalEmail: { type: String },
  cryptoAddress: { type: String },
  likedAdmins: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ],
  likedUsers: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ],
  // Additional profile/bio fields
  bio: { type: String, default: '' },
  interests: { type: String, default: '' },
  achievements: { type: String, default: '' },
  socialLinks: [{ type: String }]
},
{ timestamps: true });

module.exports = mongoose.model('User', userSchema);
