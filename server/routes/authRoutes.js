const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const SuggestedAdmin = require('../models/SuggestedAdmin');
const Video = require('../models/Video');
// NEW: Import DiscoverAdmin model
const DiscoverAdmin = require('../models/DiscoverAdmin');

const adminEmails = [
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com',
  'admin4@example.com',
  'admin5@example.com'
];

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  next();
}

function requireAdmin1(req, res, next) {
  if (
    !req.session.user ||
    req.session.user.role !== 'admin' ||
    req.session.user.email.toLowerCase() !== 'admin1@example.com'
  ) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden - only admin1@example.com can do this.'
    });
  }
  next();
}

// Multer storage setup
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });
router.upload = upload;

/* =====================
   REGISTER
===================== */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ status: 'error', message: 'Username is already taken.' });
    }
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ status: 'error', message: 'Email is already used.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    let role = 'user';
    if (adminEmails.includes(email.toLowerCase())) {
      role = 'admin';
    }
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
      subscriptions: []
    });
    await newUser.save();
    return res.status(201).json({ status: 'success', message: 'User registered successfully!' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error during registration.' });
  }
});

/* =====================
   DELETE SELF
===================== */
router.post('/delete-self', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
    });
    return res.status(200).json({ status: 'success', message: 'Your account has been deleted.' });
  } catch (err) {
    console.error('Delete self error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error deleting account.' });
  }
});

/* =====================
   UPLOAD STORY (Admins Only)
===================== */
router.post(
  '/me/upload-story',
  requireAuth,
  upload.single('storyFile'),
  async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ status: 'error', message: 'Not authorized.' });
      }
      if (req.session.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Only admins can upload a story.' });
      }
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No story file uploaded.' });
      }
      const userDoc = await User.findById(req.session.user.id);
      if (!userDoc) {
        return res.status(404).json({ status: 'error', message: 'User not found.' });
      }
      userDoc.storyUrl = '/uploads/' + req.file.filename;
      await userDoc.save();
      return res.status(200).json({ status: 'success', message: 'Story uploaded!', storyUrl: userDoc.storyUrl });
    } catch (err) {
      console.error('Upload story error:', err);
      return res.status(500).json({ status: 'error', message: 'Server error uploading story.' });
    }
  }
);

/* =====================
   LOGIN
===================== */
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const user = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
    if (!user) {
      return res.status(400).json({ status: 'error', message: 'User not found.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ status: 'error', message: 'Invalid password.' });
    }
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic || '',
      profileBanner: user.profileBanner || '',
      bannerPic: user.bannerPic || '',
      previewBanner: user.previewBanner || ''
    };
    return res.status(200).json({ status: 'success', message: 'Login successful', user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error during login.' });
  }
});

/* =====================
   LOGOUT
===================== */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ status: 'error', message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ status: 'success', message: 'Logged out successfully' });
  });
});

/* =====================
   GET ALL USERS (ADMIN only)
===================== */
router.get('/all-users', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden - not an admin.' });
    }
    const users = await User.find({});
    return res.status(200).json({ status: 'success', users });
  } catch (err) {
    console.error('All-users error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching users.' });
  }
});

/* =====================
   GET ALL ADMINS (Any user)
===================== */
router.get('/all-admins', requireAuth, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }, { password: 0 });
    return res.status(200).json({ status: 'success', admins });
  } catch (err) {
    console.error('All-admins error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching admins.' });
  }
});

/* =====================
   MY SUBSCRIPTIONS
===================== */
router.get('/my-subscriptions', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id)
      .populate('subscriptions.adminId', 'username profilePic role')
      .lean();
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const subs = (user.subscriptions || [])
      .filter(s => s.adminId && s.adminId.role === 'admin')
      .map(s => ({
        _id: s.adminId._id,
        username: s.adminId.username,
        profilePic: s.adminId.profilePic || '',
        validUntil: s.validUntil
      }));
    return res.status(200).json({ status: 'success', subscriptions: subs });
  } catch (err) {
    console.error('my-subscriptions error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching subscriptions.' });
  }
});

/* =====================
   MY FOLLOWS
===================== */
router.get('/my-follows', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id)
      .populate('follows', 'username profilePic role')
      .lean();
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    return res.status(200).json({ status: 'success', follows: user.follows || [] });
  } catch (err) {
    console.error('my-follows error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching follows.' });
  }
});

/* =====================
   GET /me => Return user data
===================== */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    return res.status(200).json({ status: 'success', user });
  } catch (err) {
    console.error('GET /me error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching user profile.' });
  }
});

/* =====================
   POST /me/update-bio
===================== */
router.post('/me/update-bio', requireAuth, async (req, res) => {
  try {
    const { bio, interests, achievements, socialLinks } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    user.bio = bio || '';
    user.interests = interests || '';
    user.achievements = achievements || '';
    user.socialLinks = Array.isArray(socialLinks) ? socialLinks : [];
    await user.save();
    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profilePic: user.profilePic,
      profileBanner: user.profileBanner,
      bannerPic: user.bannerPic,
      previewBanner: user.previewBanner,
      bio: user.bio,
      interests: user.interests,
      achievements: user.achievements,
      socialLinks: user.socialLinks,
      adminBundles: user.adminBundles
    };
    return res.status(200).json({ status: 'success', message: 'Profile info saved!', user: userData });
  } catch (err) {
    console.error('Update-bio error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error updating profile info.' });
  }
});

/* =====================
   UPDATE EMAIL
===================== */
router.post('/update-email', requireAuth, async (req, res) => {
  try {
    const { currentEmail, newEmail, profilePic } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    if (user.email !== currentEmail) {
      return res.status(400).json({ status: 'error', message: 'Current email does not match.' });
    }
    user.email = newEmail;
    if (profilePic !== undefined) {
      user.profilePic = profilePic;
    }
    await user.save();
    req.session.user.email = user.email;
    req.session.user.profilePic = user.profilePic || '';
    return res.status(200).json({ status: 'success', message: 'Email updated successfully.', user: req.session.user });
  } catch (err) {
    console.error('Update email error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error updating email.' });
  }
});

/* =====================
   UPDATE PASSWORD
===================== */
router.post('/update-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ status: 'error', message: 'Current password is incorrect.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();
    return res.status(200).json({ status: 'success', message: 'Password updated successfully.', user: req.session.user });
  } catch (err) {
    console.error('Update password error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error updating password.' });
  }
});

/* =====================
   UPDATE Payment method
===================== */
router.post('/update', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    const { paymentMethod, cardNumber, cardExp, cardCVC, paypalEmail, cryptoAddress } = req.body;
    user.paymentMethod = paymentMethod || '';
    user.cardNumber = cardNumber || '';
    user.cardExp = cardExp || '';
    user.cardCVC = cardCVC || '';
    user.paypalEmail = paypalEmail || '';
    user.cryptoAddress = cryptoAddress || '';
    await user.save();
    return res.status(200).json({ status: 'success', message: 'Payment method updated successfully.', user: req.session.user });
  } catch (err) {
    console.error('Update payment error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error updating payment.' });
  }
});

/* =====================
   DELETE USER => ONLY admin1
===================== */
router.post('/delete-user', requireAuth, requireAdmin1, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'No userId provided.' });
    }
    if (userId === req.session.user.id) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Cannot delete your own admin1 account.' });
    }
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'User not found or already deleted.' });
    }
    return res.status(200).json({ status: 'success', message: 'User account deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error deleting user.' });
  }
});

/* =====================
   me/update-profile-pic
===================== */
router.post(
  '/me/update-profile-pic',
  requireAuth,
  upload.single('profilePic'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No profile pic file received.' });
      }
      const userId = req.session.user.id;
      const userDoc = await User.findById(userId);
      if (!userDoc) {
        return res.status(404).json({ status: 'error', message: 'User not found.' });
      }
      userDoc.profilePic = '/uploads/' + req.file.filename;
      await userDoc.save();
      req.session.user.profilePic = userDoc.profilePic || '';
      return res.status(200).json({ status: 'success', message: 'Profile pic updated', user: req.session.user });
    } catch (err) {
      console.error('Profile pic update error:', err);
      return res.status(500).json({ status: 'error', message: 'Server error updating profile pic.' });
    }
  }
);

/* =====================
   me/update-profile-banner
   (Updates the admin’s feed banner)
===================== */
router.post(
  '/me/update-profile-banner',
  requireAuth,
  upload.single('profileBanner'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No banner pic file received.' });
      }
      const userId = req.session.user.id;
      const userDoc = await User.findById(userId);
      if (!userDoc) {
        return res.status(404).json({ status: 'error', message: 'User not found.' });
      }
      userDoc.profileBanner = '/uploads/' + req.file.filename;
      await userDoc.save();
      req.session.user.profileBanner = userDoc.profileBanner;
      return res.status(200).json({ status: 'success', message: 'Profile feed banner updated!', user: req.session.user });
    } catch (err) {
      console.error('Profile banner update error:', err);
      return res.status(500).json({ status: 'error', message: 'Server error uploading banner photo.' });
    }
  }
);

/* =====================
   me/update-banner-pic => for suggested banner
===================== */
router.post(
  '/me/update-banner-pic',
  requireAuth,
  upload.single('bannerPic'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No banner pic file received.' });
      }
      const userId = req.session.user.id;
      const userDoc = await User.findById(userId);
      if (!userDoc) {
        return res.status(404).json({ status: 'error', message: 'User not found.' });
      }
      userDoc.bannerPic = '/uploads/' + req.file.filename;
      await userDoc.save();
      req.session.user.bannerPic = userDoc.bannerPic;
      return res.status(200).json({ status: 'success', message: 'Suggested creators banner updated!', user: req.session.user });
    } catch (err) {
      console.error('Suggested banner update error:', err);
      return res.status(500).json({ status: 'error', message: 'Server error uploading suggested banner.' });
    }
  }
);

/* =====================
   NEW: me/update-preview-banner => Update the Preview Banner (for all users)
===================== */
router.post(
  '/me/update-preview-banner',
  requireAuth,
  upload.single('previewBanner'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No preview banner file received.' });
      }
      const userId = req.session.user.id;
      const userDoc = await User.findById(userId);
      if (!userDoc) {
        return res.status(404).json({ status: 'error', message: 'User not found.' });
      }
      userDoc.previewBanner = '/uploads/' + req.file.filename;
      await userDoc.save();
      req.session.user.previewBanner = userDoc.previewBanner;
      return res.status(200).json({ status: 'success', message: 'Preview banner updated!', user: req.session.user });
    } catch (err) {
      console.error('Preview banner update error:', err);
      return res.status(500).json({ status: 'error', message: 'Server error uploading preview banner.' });
    }
  }
);

/* =====================
   GET /get-suggested
===================== */
router.get('/get-suggested', async (req, res) => {
  try {
    const list = await SuggestedAdmin.find({})
      .populate('adminId', 'username profilePic role bannerPic')
      .lean();
    const suggested = [];
    for (const item of list) {
      if (!item.adminId) continue;
      const adminId = item.adminId._id;
      const recentUploads = await Video.find({ uploader: adminId })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
      const previews = recentUploads.map((vid) => ({
        url: vid.videoUrl,
        isPhoto: vid.isPhoto
      }));
      suggested.push({
        _id: adminId,
        username: item.adminId.username,
        role: item.adminId.role,
        profilePic: item.adminId.profilePic || '',
        bannerPic: item.adminId.bannerPic || '',
        recentMedia: previews
      });
    }
    return res.status(200).json({ status: 'success', suggested });
  } catch (err) {
    console.error('Get-suggested error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching suggested admins.' });
  }
});

/* =====================
   Leave this alone: it manages "suggested" 
   (the user said do not touch!)
===================== */
router.post('/update-suggested', requireAuth, async (req, res) => {
  try {
    if (
      !req.session.user ||
      req.session.user.role !== 'admin' ||
      req.session.user.email.toLowerCase() !== 'admin1@example.com'
    ) {
      return res.status(403).json({ status: 'error', message: 'Forbidden - only admin1@example.com can do this.' });
    }
    const { action, adminId } = req.body;
    if (!adminId || !action) {
      return res.status(400).json({ status: 'error', message: 'Please provide action and adminId.' });
    }
    // Notice this actually updates DiscoverAdmin, but the user wants it unchanged:
    if (action === 'add') {
      // Check if already in suggested
      const exists = await SuggestedAdmin.findOne({ adminId });
      if (exists) {
        return res.status(200).json({
          status: 'success',
          message: 'That admin is already in the Suggested list.'
        });
      }
      await SuggestedAdmin.create({ adminId });
      return res.status(200).json({
        status: 'success',
        message: 'Admin added to Suggested Creators.'
      });
    } else if (action === 'remove') {
      const removed = await SuggestedAdmin.findOneAndDelete({ adminId });
      if (!removed) {
        return res.status(404).json({
          status: 'error',
          message: 'That admin was not found in Suggested.'
        });
      }
      return res.status(200).json({
        status: 'success',
        message: 'Admin removed from Suggested Creators.'
      });
    } else {
      return res.status(400).json({ status: 'error', message: 'Invalid action. Must be add or remove.' });
    }
  } catch (err) {
    console.error('Update-suggested error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error updating suggested admins.' });
  }
});

/* =====================
   GET /user-full/:userId (ADMIN only)
===================== */
router.get('/user-full/:userId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden - must be admin.' });
    }
    const { userId } = req.params;
    const fullUser = await User.findById(userId).lean();
    if (!fullUser) {
      return res.status(404).json({ status: 'error', message: 'No user found.' });
    }
    const userUploads = await Video.find({ uploader: userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ status: 'success', user: fullUser, uploads: userUploads });
  } catch (err) {
    console.error('User-full error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error fetching user full info.' });
  }
});

/* =====================
   GET /get-discover 
   (Returns list of all admins in Discover)
===================== */
router.get('/get-discover', async (req, res) => {
  try {
    const discoverDocs = await DiscoverAdmin.find({})
      .populate('adminId', 'username profilePic role')
      .lean();
    return res.status(200).json({ status: 'success', discover: discoverDocs });
  } catch (err) {
    console.error('get-discover error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching discover admins.'
    });
  }
});

/* =====================
   NEW: /update-discover 
   (What your MasterPage calls in handleUpdateDiscoverAdmin)
===================== */
router.post('/update-discover', requireAuth, requireAdmin1, async (req, res) => {
  try {
    const { action, adminId } = req.body;
    if (!adminId || !action) {
      return res.status(400).json({ status: 'error', message: 'Please provide action and adminId.' });
    }
    if (action === 'add') {
      const existing = await DiscoverAdmin.findOne({ adminId });
      if (existing) {
        return res.status(200).json({
          status: 'success',
          message: 'That admin is already in Discover.'
        });
      }
      await DiscoverAdmin.create({ adminId, photos: [] });
      return res.status(200).json({ status: 'success', message: 'Admin added to Discover.' });
    } else if (action === 'remove') {
      const removed = await DiscoverAdmin.findOneAndDelete({ adminId });
      if (!removed) {
        return res.status(404).json({
          status: 'error',
          message: 'That admin was not in Discover.'
        });
      }
      return res.status(200).json({ status: 'success', message: 'Admin removed from Discover.' });
    } else {
      return res.status(400).json({ status: 'error', message: 'Invalid action. Must be add or remove.' });
    }
  } catch (err) {
    console.error('update-discover error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error updating discover admins.'
    });
  }
});

/* =====================
   NEW: /upload-discover-photo/:adminId
   (What your MasterPage calls in handleUploadDiscoverPhoto)
===================== */
router.post(
  '/upload-discover-photo/:adminId',
  requireAuth,
  requireAdmin1,
  upload.single('photo'),
  async (req, res) => {
    try {
      const { adminId } = req.params;
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No photo file received.'
        });
      }
      const discoverDoc = await DiscoverAdmin.findOne({ adminId });
      if (!discoverDoc) {
        return res.status(404).json({
          status: 'error',
          message: 'That admin is not currently on the Discover list.'
        });
      }
      // Push new photo path into the photos array
      discoverDoc.photos.push('/uploads/' + req.file.filename);
      await discoverDoc.save();

      return res.status(200).json({
        status: 'success',
        message: 'Discover photo uploaded!',
        photos: discoverDoc.photos
      });
    } catch (err) {
      console.error('upload-discover-photo error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error uploading discover photo.'
      });
    }
  }
);

/* =====================
   OPTIONAL: fix the 400 error from /like-admin
   If your DiscoverPage calls /messages/like-admin/:adminId,
   add a minimal route here:
===================== */
router.post('/like-admin/:adminId', requireAuth, async (req, res) => {
  try {
    // Insert logic for "liking" an admin if needed
    return res.status(200).json({
      status: 'success',
      message: 'Admin liked (stubbed).'
    });
  } catch (err) {
    console.error('like-admin error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error liking admin.' });
  }
});

module.exports = router;
