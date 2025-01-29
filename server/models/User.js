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

  /* NEW field => admin’s banner photo, used in suggested creators. */
  bannerPic: {
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
    { type: Schema.Types.ObjectId, ref: 'User' }
  ],
  subscriptions: [
    {
      adminId: { type: Schema.Types.ObjectId, ref: 'User' },
      validUntil: { type: Date }
    }
  ],

  adminBundles: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
      title: String,
      price: Number,
      description: String,

      // Added for cover images:
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
    { type: Schema.Types.ObjectId, ref: 'User' }
  ],
  likedUsers: [
    { type: Schema.Types.ObjectId, ref: 'User' }
  ],

  // Additional profile/bio fields
  bio: { type: String, default: '' },
  interests: { type: String, default: '' },
  achievements: { type: String, default: '' },
  socialLinks: [{ type: String }]
},
{ timestamps: true });

module.exports = mongoose.model('User', userSchema);
