const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Video = require('../models/Video');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  next();
}

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

/**
 * GET /api/profile/:adminId => fetch admin’s posts & show locked/unlocked
 */
router.get('/:adminId', requireAuth, async (req, res) => {
  try {
    const { adminId } = req.params;
    const targetUser = await User.findById(adminId);
    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    let items = await Video.find({ uploader: adminId }).sort({ createdAt: -1 }).lean();
    const currentUser = await User.findById(req.session.user.id).lean();

    const subList = currentUser.subscriptions || [];
    const subscribedAdminIds = subList.map((s) => s.adminId.toString());
    const isSubscribed = subscribedAdminIds.includes(adminId);

    // Check if the current user is the same person as the "adminId" profile
    const isOwner = currentUser._id.toString() === adminId;

    // If locked => must be subscribed or an unlocker (or the owner)
    items = items.map((item) => {
      const userUnlocked = (item.unlockers || []).some(
        (u) => u.toString() === currentUser._id.toString()
      );
      if (item.locked && !isOwner && !isSubscribed && !userUnlocked) {
        return { ...item, videoUrl: null, locked: true };
      }
      return item;
    });

    return res.status(200).json({
      status: 'success',
      admin: {
        _id: targetUser._id,
        username: targetUser.username,
        profilePic: targetUser.profilePic || '',
        bannerPic: targetUser.bannerPic || '',
        bio: targetUser.bio || '',
        interests: targetUser.interests || '',
        achievements: targetUser.achievements || '',
        adminBundles: targetUser.adminBundles || [],
      },
      items,
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching profile.',
    });
  }
});

/**
 * Follow an admin
 */
router.post('/:adminId/follow', requireAuth, async (req, res) => {
  try {
    const { adminId } = req.params;
    const targetUser = await User.findById(adminId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ status: 'error', message: 'User not found.' });
    }
    const user = await User.findById(req.session.user.id);
    if (!user.follows) user.follows = [];
    if (!user.follows.includes(adminId)) {
      user.follows.push(adminId);
      await user.save();
    }
    return res.status(200).json({
      status: 'success',
      message: 'Followed successfully!',
    });
  } catch (err) {
    console.error('Follow error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error following user.',
    });
  }
});

/**
 * Subscribe => paid
 */
router.post('/:adminId/subscribe', requireAuth, async (req, res) => {
  try {
    const { adminId } = req.params;
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found or not an admin.',
      });
    }
    const user = await User.findById(req.session.user.id);
    if (!user.paymentMethod || user.paymentMethod.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'No payment method found. Please go to Settings -> Payment.',
      });
    }
    // 30 days sub
    const DAY_MS = 24 * 60 * 60 * 1000;
    const validUntil = new Date(Date.now() + 30 * DAY_MS);
    if (!user.subscriptions) user.subscriptions = [];
    const existingSub = user.subscriptions.find(
      (s) => s.adminId.toString() === adminId
    );
    if (existingSub) {
      existingSub.validUntil = validUntil;
    } else {
      user.subscriptions.push({ adminId, validUntil });
    }
    await user.save();
    return res.status(200).json({
      status: 'success',
      message: 'Subscribed successfully!',
      validUntil,
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error subscribing.',
    });
  }
});

/**
 * One-time unlock
 */
router.post('/:adminId/unlock/:contentId', requireAuth, async (req, res) => {
  try {
    const { adminId, contentId } = req.params;
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found.',
      });
    }
    const user = await User.findById(req.session.user.id);
    if (!user.paymentMethod || user.paymentMethod.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'No payment method found. Please go to Settings -> Payment.',
      });
    }
    const videoDoc = await Video.findById(contentId);
    if (!videoDoc) {
      return res.status(404).json({
        status: 'error',
        message: 'Content not found.',
      });
    }
    if (!videoDoc.unlockers) {
      videoDoc.unlockers = [];
    }
    if (!videoDoc.unlockers.includes(user._id)) {
      videoDoc.unlockers.push(user._id);
    }
    await videoDoc.save();
    return res.status(200).json({
      status: 'success',
      message: 'Unlocked successfully!',
    });
  } catch (err) {
    console.error('Unlock error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error unlocking content.',
    });
  }
});

/**
 * Normal user uploading to personal profile
 */
router.post('/me/upload-media', requireAuth, upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ status: 'error', message: 'No file attached.' });
    }

    // Grab `title` if the client sends it
    let { title, isPhoto } = req.body;

    // Build final file path
    const filePath = '/uploads/' + req.file.filename;

    // Auto-detect photo by extension
    const ext = path.extname(req.file.filename).toLowerCase();
    // UPDATED: same extension list
    const isImageExtension = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.edr', '.fdgx'].includes(ext);

    // Combine both checks: extension + front-end "Photo?" checkbox
    const finalIsPhoto =
      (isPhoto === 'true' || isPhoto === true) || isImageExtension;

    const newVideo = new Video({
      title: (title && title.trim()) ? title.trim() : 'My Personal Upload',
      videoUrl: filePath,
      isPhoto: finalIsPhoto,
      locked: false,
      price: 0,
      uploader: req.session.user.id,
    });
    await newVideo.save();

    return res.status(200).json({
      status: 'success',
      message: 'Profile media uploaded successfully!',
      video: newVideo,
    });
  } catch (err) {
    console.error('profile upload error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error uploading profile media.',
    });
  }
});

/**
 * DELETE => only if user is uploader
 */
router.delete('/me/delete-media/:videoId', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.session.user.id;
    const vidDoc = await Video.findById(videoId);
    if (!vidDoc) {
      return res
        .status(404)
        .json({ status: 'error', message: 'Media not found.' });
    }
    if (vidDoc.uploader.toString() !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not your media to delete.',
      });
    }
    // Only unlink if path starts with '/uploads/'
    if (vidDoc.videoUrl && vidDoc.videoUrl.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '..', 'public', vidDoc.videoUrl);
      fs.unlink(localPath, (err) => {
        if (err) {
          console.error('Could not remove file from disk:', err);
        }
      });
    }
    await Video.deleteOne({ _id: videoId });
    return res.status(200).json({
      status: 'success',
      message: 'Media deleted successfully.',
    });
  } catch (err) {
    console.error('delete-media error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error deleting media.',
    });
  }
});

/**
 * POST /api/profile/me/create-bundle => admin only
 */
router.post('/me/create-bundle', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    if (userDoc.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Only admins can create bundles.' });
    }

    const { title, price, description } = req.body;
    if (!title || !price) {
      return res.status(400).json({
        status: 'error',
        message: 'Bundle title and price are required.',
      });
    }

    userDoc.adminBundles.push({
      title,
      price,
      description: description || '',
    });
    await userDoc.save();

    return res.status(200).json({
      status: 'success',
      message: 'Bundle created successfully!',
      adminBundles: userDoc.adminBundles,
    });
  } catch (err) {
    console.error('create-bundle error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error creating bundle.',
    });
  }
});

/**
 * POST /api/profile/:adminId/buy-bundle/:bundleId => normal user “buy” the admin’s bundle
 */
router.post('/:adminId/buy-bundle/:bundleId', requireAuth, async (req, res) => {
  try {
    const { adminId, bundleId } = req.params;
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({ status: 'error', message: 'Admin not found.' });
    }
    const theBundle = adminUser.adminBundles.find((b) => b._id.toString() === bundleId);
    if (!theBundle) {
      return res.status(404).json({ status: 'error', message: 'Bundle not found.' });
    }
    const buyer = await User.findById(req.session.user.id);
    if (!buyer.paymentMethod || buyer.paymentMethod.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'No payment method found. Please go to Settings -> Payment.',
      });
    }
    if (!buyer.purchasedBundles) {
      buyer.purchasedBundles = [];
    }
    if (!buyer.purchasedBundles.some((b) => b.bundleId.toString() === bundleId)) {
      buyer.purchasedBundles.push({
        bundleId: theBundle._id,
        adminId: adminUser._id,
        title: theBundle.title,
        price: theBundle.price,
        purchasedAt: new Date(),
      });
    }
    await buyer.save();

    return res.status(200).json({
      status: 'success',
      message: `Bundle "${theBundle.title}" purchased successfully!`,
    });
  } catch (err) {
    console.error('buy-bundle error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error purchasing bundle.',
    });
  }
});

/**
 * POST /api/profile/me/upload-bundle-cover/:bundleId
 */
router.post(
  '/me/upload-bundle-cover/:bundleId',
  requireAuth,
  upload.single('bundleCover'),
  async (req, res) => {
    try {
      const userId = req.session.user.id;
      const userDoc = await User.findById(userId);

      if (!userDoc || userDoc.role !== 'admin') {
        return res
          .status(403)
          .json({ status: 'error', message: 'Only admins can upload bundle covers.' });
      }
      if (!req.file) {
        return res
          .status(400)
          .json({ status: 'error', message: 'No cover file uploaded.' });
      }

      const { bundleId } = req.params;
      const theBundle = userDoc.adminBundles.find(
        (b) => b._id.toString() === bundleId
      );
      if (!theBundle) {
        return res
          .status(404)
          .json({ status: 'error', message: 'Bundle not found.' });
      }

      theBundle.coverUrl = '/uploads/' + req.file.filename;
      await userDoc.save();

      return res.status(200).json({
        status: 'success',
        message: 'Bundle cover updated!',
        adminBundles: userDoc.adminBundles,
      });
    } catch (err) {
      console.error('upload-bundle-cover error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error updating bundle cover.',
      });
    }
  }
);

/**
 * DELETE /api/profile/me/delete-bundle/:bundleId
 */
router.delete('/me/delete-bundle/:bundleId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    if (userDoc.role !== 'admin') {
      return res
        .status(403)
        .json({ status: 'error', message: 'Only admins can delete bundles.' });
    }
    const { bundleId } = req.params;
    // filter out that bundle
    const oldLength = userDoc.adminBundles.length;
    userDoc.adminBundles = userDoc.adminBundles.filter(
      (b) => b._id.toString() !== bundleId
    );
    if (userDoc.adminBundles.length === oldLength) {
      return res
        .status(404)
        .json({ status: 'error', message: 'Bundle not found or already removed.' });
    }
    await userDoc.save();
    return res.status(200).json({
      status: 'success',
      message: 'Bundle deleted successfully.',
      adminBundles: userDoc.adminBundles,
    });
  } catch (err) {
    console.error('Delete bundle error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error deleting bundle.',
    });
  }
});

/**
 * PATCH /api/profile/me/update-bundle/:bundleId
 */
router.patch('/me/update-bundle/:bundleId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    if (userDoc.role !== 'admin') {
      return res
        .status(403)
        .json({ status: 'error', message: 'Only admins can edit bundles.' });
    }
    const { bundleId } = req.params;
    const { title, price, description } = req.body;

    const theBundle = userDoc.adminBundles.find(
      (b) => b._id.toString() === bundleId
    );
    if (!theBundle) {
      return res.status(404).json({
        status: 'error',
        message: 'Bundle not found.',
      });
    }

    // Update only if provided
    if (typeof title === 'string') theBundle.title = title;
    if (typeof price === 'number') theBundle.price = price;
    if (typeof description === 'string') theBundle.description = description;

    await userDoc.save();
    return res.status(200).json({
      status: 'success',
      message: 'Bundle updated successfully.',
      adminBundles: userDoc.adminBundles,
    });
  } catch (err) {
    console.error('Update bundle error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error updating bundle.',
    });
  }
});

module.exports = router;
